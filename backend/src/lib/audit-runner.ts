import { db } from "@backend/lib/db";
import { crawlWebsite } from "@backend/lib/crawler";
import { collectExternalData } from "@backend/lib/integrations";
import { analyzeAudit } from "@backend/lib/ai";
import { generatePdf } from "@backend/lib/reports";
import { scoreSeoSignals } from "@backend/lib/seo-scoring";
import { sendEmail, sendWhatsApp } from "@backend/mocks/index.js";

async function progress(auditId: string, value: number, status: string, onProgress?: (value: number) => Promise<void>) {
  await db().query(
    "UPDATE audits SET progress=$2, status=$3, error_message=CASE WHEN $3='running' THEN NULL ELSE error_message END, updated_at=now() WHERE id=$1",
    [auditId, value, status]
  );
  await onProgress?.(value);
}

export async function runAudit(auditId: string, onProgress?: (value: number) => Promise<void>) {
  try {
    await progress(auditId, 5, "running", onProgress);
    const auditQuery = await db().query(
      `SELECT a.id,a.client_id,a.website_url,c.business_type,c.business_location,c.contact_email,c.contact_phone
       FROM audits a JOIN clients c ON c.id=a.client_id WHERE a.id=$1`,
      [auditId]
    );
    const audit = auditQuery.rows[0];
    if (!audit) throw new Error("Audit record or client not found");
    const crawl = await crawlWebsite(audit.website_url);
    await progress(auditId, 25, "running", onProgress);
    const integrations = await collectExternalData(audit.website_url);
    await progress(auditId, 45, "running", onProgress);
    const structured = {
      url: audit.website_url,
      business_type: audit.business_type,
      business_location: audit.business_location,
      on_page: {
        title: crawl.title, metaDescription: crawl.metaDescription, headings: crawl.headings,
        images: crawl.images, links: crawl.links, canonical: crawl.canonical
      },
      technical: { robotsTxt: crawl.robotsTxt, sitemapAvailable: crawl.sitemapAvailable },
      core_web_vitals: integrations.pagespeed,
      schema: {
        types: crawl.schemaTypes,
        validation: crawl.schemaValidation,
        hasStructuredData: crawl.schemaTypes.length > 0
      },
      gsc: integrations.gsc,
      keyword_rankings: integrations.dataforseo,
      mock_data: integrations.mock_data
    };
    const analysis = await analyzeAudit(structured);
    const result = { ...analysis, ...scoreSeoSignals(structured) };
    await progress(auditId, 70, "running", onProgress);
    await db().query(
      `INSERT INTO audit_results (audit_id,result_json,source_data) VALUES ($1,$2,$3)
       ON CONFLICT (audit_id) DO UPDATE SET result_json=EXCLUDED.result_json, source_data=EXCLUDED.source_data`,
      [auditId, JSON.stringify(result), JSON.stringify(structured)]
    );
    const filePath = await generatePdf(auditId, result, audit.website_url);
    await db().query(
      `INSERT INTO audit_reports (audit_id,storage_path,created_at) VALUES ($1,$2,now())
       ON CONFLICT (audit_id) DO UPDATE SET storage_path=EXCLUDED.storage_path, created_at=now()`,
      [auditId, filePath]
    );
    sendWhatsApp({ clientId: audit.client_id, pdfPath: filePath, score: result.overall_score });
    sendEmail({ to: audit.contact_email, auditId });
    await progress(auditId, 100, "completed", onProgress);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected audit failure";
    await db().query("UPDATE audits SET status='failed',error_message=$2,updated_at=now() WHERE id=$1", [auditId, message]);
    throw error;
  }
}

import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@backend/lib/db";
import { withApiErrors } from "@/lib/api-errors";
import { applySeoScore } from "@backend/lib/seo-scoring";
import { generatePdf } from "@backend/lib/reports";
import { auditResultSchema } from "@backend/lib/audit-schema";

export const dynamic = "force-dynamic";

export const GET = withApiErrors("reports.download", async (_request: Request, { params }: { params: { auditId: string } }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const query = await db().query(
    `SELECT p.storage_path,a.client_id,a.website_url,r.result_json,r.source_data
     FROM audit_reports p JOIN audits a ON a.id=p.audit_id
     LEFT JOIN audit_results r ON r.audit_id=a.id WHERE p.audit_id=$1`,
    [params.auditId]
  );
  const report = query.rows[0];
  if (!report || (session.role === "client" && report.client_id !== session.clientId)) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  try {
    const scoredResult = applySeoScore(report.result_json, report.source_data);
    if (
      scoredResult &&
      typeof scoredResult === "object" &&
      "overall_score" in scoredResult &&
      String(scoredResult.overall_score) !== String(report.result_json?.overall_score)
    ) {
      await generatePdf(params.auditId, auditResultSchema.parse(scoredResult), report.website_url);
    }
    const file = await readFile(report.storage_path);
    return new NextResponse(file, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="seo-audit-${params.auditId}.pdf"`, "cache-control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Report file is unavailable" }, { status: 404 });
  }
});

import { db } from "../lib/db";
import { getAuditQueue } from "../lib/queue";
import { scoreSeoSignals } from "../lib/seo-scoring";

export async function listAudits() {
  const result = await db().query(
    `SELECT a.id, a.client_id, c.name AS client_name, a.website_url, a.status, a.progress, a.error_message, a.created_at, a.updated_at,
       ar.result_json, ar.source_data
     FROM audits a JOIN clients c ON c.id = a.client_id
     LEFT JOIN audit_results ar ON ar.audit_id = a.id
     ORDER BY a.created_at DESC LIMIT 200`
  );

  return result.rows.map((row) => ({
    ...row,
    overall_score: row.result_json ? scoreSeoSignals(row.source_data).overall_score : null,
    result_json: undefined,
    source_data: undefined
  }));
}

export async function listClientAudits(clientId: string) {
  const result = await db().query(
    `SELECT a.id, a.website_url, a.status, a.progress, a.error_message, a.created_at,
       r.result_json AS result, r.source_data AS source_data, p.audit_id IS NOT NULL AS has_report
     FROM audits a
     LEFT JOIN audit_results r ON r.audit_id = a.id
     LEFT JOIN audit_reports p ON p.audit_id = a.id
     WHERE a.client_id = $1 ORDER BY a.created_at DESC`,
    [clientId]
  );

  return result.rows.map((row) => ({
    ...row,
    result: row.result && row.source_data ? { ...row.result, ...scoreSeoSignals(row.source_data) } : row.result,
    source_data: undefined
  }));
}

export async function createAudit(clientId: string, websiteUrl: string, createdBy: string) {
  const client = await db().query("SELECT id FROM clients WHERE id=$1", [clientId]);
  if (!client.rowCount) {
    const error = new Error("Client not found") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  const created = await db().query(
    `INSERT INTO audits(client_id,website_url,status,created_by) VALUES($1,$2,'queued',$3) RETURNING id, status, progress, created_at`,
    [clientId, websiteUrl, createdBy]
  );

  const job = await getAuditQueue().add("run-audit", { auditId: created.rows[0].id }, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200
  });

  return { ...created.rows[0], job_id: job.id };
}

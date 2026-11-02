import { db } from "../lib/db";
import { scoreSeoSignals } from "../lib/seo-scoring";

export async function getDashboardStats() {
  const metricsResult = await db().query(
    `SELECT
      (SELECT COUNT(*)::int FROM clients) AS total_clients,
      (SELECT COUNT(*)::int FROM audits) AS total_audits,
      (SELECT COUNT(*)::int FROM audits WHERE status='completed') AS completed_audits,
      (SELECT COUNT(*)::int FROM audits WHERE status='failed') AS failed_audits`
  );

  const scoreRows = await db().query(
    `SELECT source_data FROM audits a JOIN audit_results ar ON ar.audit_id = a.id WHERE a.status='completed'`
  );

  const avgScore = scoreRows.rows.length
    ? Number((scoreRows.rows.reduce((total, row) => total + scoreSeoSignals(row.source_data).overall_score, 0) / scoreRows.rows.length).toFixed(1))
    : null;

  const recentAudits = await db().query(
    `SELECT a.id, c.name AS client_name, a.website_url, a.status, a.progress, a.created_at, a.error_message,
       ar.result_json, ar.source_data
     FROM audits a
     JOIN clients c ON c.id = a.client_id
     LEFT JOIN audit_results ar ON ar.audit_id = a.id
     ORDER BY a.created_at DESC
     LIMIT 8`
  );

  return {
    metrics: {
      total_clients: Number(metricsResult.rows[0].total_clients),
      total_audits: Number(metricsResult.rows[0].total_audits),
      completed_audits: Number(metricsResult.rows[0].completed_audits),
      failed_audits: Number(metricsResult.rows[0].failed_audits),
      average_score: avgScore
    },
    recent: recentAudits.rows.map((row) => ({
      id: row.id,
      client_name: row.client_name,
      website_url: row.website_url,
      status: row.status,
      progress: Number(row.progress),
      created_at: row.created_at,
      error_message: row.error_message,
      overall_score: row.result_json ? scoreSeoSignals(row.source_data).overall_score : null
    }))
  };
}

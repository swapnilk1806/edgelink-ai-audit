import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@backend/lib/db";
import { withApiErrors } from "@/lib/api-errors";
import { scoreSeoSignals } from "@backend/lib/seo-scoring";

export const dynamic = "force-dynamic";

export const GET = withApiErrors("admin.overview", async () => {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [metrics, recent, scores] = await Promise.all([
    db().query(
      `SELECT
       (SELECT count(*)::int FROM clients) AS total_clients,
       (SELECT count(*)::int FROM audits) AS total_audits,
       (SELECT count(*)::int FROM audits WHERE status='completed') AS completed_audits,
       (SELECT count(*)::int FROM audits WHERE status='failed') AS failed_audits`
    ),
    db().query(
      `SELECT a.id,c.name AS client_name,a.website_url,a.status,a.progress,a.created_at,a.error_message,
       r.result_json,r.source_data FROM audits a JOIN clients c ON c.id=a.client_id
       LEFT JOIN audit_results r ON r.audit_id=a.id ORDER BY a.created_at DESC LIMIT 8`
    ),
    db().query(
      `SELECT r.source_data FROM audits a JOIN audit_results r ON r.audit_id=a.id WHERE a.status='completed'`
    )
  ]);
  const measuredScores = scores.rows.map((row) => scoreSeoSignals(row.source_data).overall_score);
  const averageScore = measuredScores.length
    ? Number((measuredScores.reduce((total, score) => total + score, 0) / measuredScores.length).toFixed(1))
    : null;
  return NextResponse.json({
    metrics: { ...metrics.rows[0], average_score: averageScore },
    recent: recent.rows.map((row) => ({
      ...row,
      overall_score: row.result_json ? scoreSeoSignals(row.source_data).overall_score : null,
      result_json: undefined,
      source_data: undefined
    }))
  });
});

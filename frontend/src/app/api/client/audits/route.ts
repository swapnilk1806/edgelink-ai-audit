import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@backend/lib/db";
import { withApiErrors } from "@/lib/api-errors";
import { applySeoScore } from "@backend/lib/seo-scoring";

export const dynamic = "force-dynamic";

export const GET = withApiErrors("client.audits.list", async () => {
  const session = await getSession();
  if (!session || session.role !== "client" || !session.clientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await db().query(
    `SELECT a.id,a.website_url,a.status,a.progress,a.error_message,a.created_at,
       r.result_json AS result, r.source_data AS source_data, p.audit_id IS NOT NULL AS has_report
     FROM audits a LEFT JOIN audit_results r ON r.audit_id=a.id LEFT JOIN audit_reports p ON p.audit_id=a.id
     WHERE a.client_id=$1 ORDER BY a.created_at DESC`,
    [session.clientId]
  );
  return NextResponse.json(result.rows.map((row) => ({
    ...row,
    result: applySeoScore(row.result, row.source_data),
    source_data: undefined
  })));
});

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@backend/lib/db";
import { getAuditQueue } from "@backend/lib/queue";
import { websiteUrlSchema } from "@backend/lib/validation";
import { withApiErrors } from "@/lib/api-errors";
import { scoreSeoSignals } from "@backend/lib/seo-scoring";

export const dynamic = "force-dynamic";

const input = z.object({ client_id: z.string().uuid(), website_url: websiteUrlSchema });
export const GET = withApiErrors("admin.audits.list", async () => {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await db().query(
    `SELECT a.id,a.client_id,c.name AS client_name,a.website_url,a.status,a.progress,a.error_message,a.created_at,a.updated_at,
      ar.result_json,ar.source_data
     FROM audits a JOIN clients c ON c.id=a.client_id LEFT JOIN audit_results ar ON ar.audit_id=a.id
     ORDER BY a.created_at DESC LIMIT 200`
  );
  return NextResponse.json(result.rows.map((row) => ({
    ...row,
    overall_score: row.result_json ? scoreSeoSignals(row.source_data).overall_score : null,
    result_json: undefined,
    source_data: undefined
  })));
});

export const POST = withApiErrors("admin.audits.create", async (request: Request) => {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = input.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message || "Invalid audit request" }, { status: 400 });
  const client = await db().query("SELECT id FROM clients WHERE id=$1", [body.data.client_id]);
  if (!client.rowCount) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const created = await db().query(
    `INSERT INTO audits(client_id,website_url,status,created_by) VALUES($1,$2,'queued',$3) RETURNING id,status,progress,created_at`,
    [body.data.client_id, body.data.website_url, session.userId]
  );
  try {
    const job = await getAuditQueue().add("run-audit", { auditId: created.rows[0].id }, {
      attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 100, removeOnFail: 200
    });
    return NextResponse.json({ ...created.rows[0], job_id: job.id }, { status: 201 });
  } catch (error) {
    await db().query("UPDATE audits SET status='failed',error_message='Could not enqueue audit job',updated_at=now() WHERE id=$1", [created.rows[0].id]);
    throw error;
  }
});

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@backend/lib/db";
import { websiteUrlSchema } from "@backend/lib/validation";
import { withApiErrors } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1).max(150), website_url: websiteUrlSchema,
  business_type: z.string().trim().min(1).max(150), business_location: z.string().trim().min(1).max(150),
  contact_name: z.string().trim().min(1).max(150), contact_email: z.string().email(),
  contact_phone: z.string().max(40).optional().nullable()
});

export const PUT = withApiErrors("admin.clients.update", async (request: Request, { params }: { params: { id: string } }) => {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message || "Invalid client details" }, { status: 400 });
  const c = body.data;
  const connection = await db().connect();
  try {
    await connection.query("BEGIN");
    const result = await connection.query(
      `UPDATE clients SET name=$2,website_url=$3,business_type=$4,business_location=$5,contact_name=$6,contact_email=$7,contact_phone=$8,updated_at=now()
       WHERE id=$1 RETURNING *`,
      [params.id,c.name,c.website_url,c.business_type,c.business_location,c.contact_name,c.contact_email,c.contact_phone || null]
    );
    if (!result.rowCount) {
      await connection.query("ROLLBACK");
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    await connection.query("UPDATE users SET email=$2 WHERE client_id=$1 AND role='client'", [params.id,c.contact_email]);
    await connection.query("COMMIT");
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    await connection.query("ROLLBACK");
    if (error instanceof Error && "code" in error && error.code === "23505") return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
    throw error;
  } finally { connection.release(); }
});

export const DELETE = withApiErrors("admin.clients.delete", async (_request: Request, { params }: { params: { id: string } }) => {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await db().query("DELETE FROM clients WHERE id=$1 RETURNING id", [params.id]);
  return result.rowCount ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Client not found" }, { status: 404 });
});

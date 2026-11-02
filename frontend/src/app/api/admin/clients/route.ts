import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@backend/lib/db";
import bcrypt from "bcryptjs";
import { websiteUrlSchema } from "@backend/lib/validation";
import { withApiErrors } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

const clientSchema = z.object({
  name: z.string().trim().min(1).max(150),
  website_url: websiteUrlSchema,
  business_type: z.string().trim().min(1).max(150),
  business_location: z.string().trim().min(1).max(150),
  contact_name: z.string().trim().min(1).max(150),
  contact_email: z.string().email(),
  contact_phone: z.string().max(40).optional().nullable(),
  login_password: z.string().min(10).optional()
});

export const GET = withApiErrors("admin.clients.list", async () => {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await db().query(
    `SELECT c.*, (SELECT u.email FROM users u WHERE u.client_id=c.id AND u.role='client' LIMIT 1) AS login_email
     FROM clients c ORDER BY c.created_at DESC`
  );
  return NextResponse.json(result.rows);
});

export const POST = withApiErrors("admin.clients.create", async (request: Request) => {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = clientSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message || "Invalid client details" }, { status: 400 });
  const { login_password, ...client } = body.data;
  const pool = db();
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const created = await connection.query(
      `INSERT INTO clients(name,website_url,business_type,business_location,contact_name,contact_email,contact_phone)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [client.name, client.website_url, client.business_type, client.business_location, client.contact_name, client.contact_email, client.contact_phone || null]
    );
    if (login_password) {
      const hash = await bcrypt.hash(login_password, 12);
      await connection.query(
        `INSERT INTO users(email,password_hash,role,client_id) VALUES($1,$2,'client',$3)`,
        [client.contact_email, hash, created.rows[0].id]
      );
    }
    await connection.query("COMMIT");
    return NextResponse.json(created.rows[0], { status: 201 });
  } catch (error) {
    await connection.query("ROLLBACK");
    if (error instanceof Error && "code" in error && error.code === "23505") return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
    throw error;
  } finally { connection.release(); }
});

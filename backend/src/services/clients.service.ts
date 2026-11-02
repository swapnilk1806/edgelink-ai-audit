import bcrypt from "bcryptjs";
import { db } from "../lib/db";

export async function listClients() {
  const result = await db().query(
    `SELECT c.*, (SELECT u.email FROM users u WHERE u.client_id=c.id AND u.role='client' LIMIT 1) AS login_email
     FROM clients c ORDER BY c.created_at DESC`
  );
  return result.rows;
}

export async function createClient(input: {
  name: string;
  website_url: string;
  business_type: string;
  business_location: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string | null;
  login_password?: string;
}) {
  const connection = await db().connect();

  try {
    await connection.query("BEGIN");
    const created = await connection.query(
      `INSERT INTO clients(name,website_url,business_type,business_location,contact_name,contact_email,contact_phone)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [input.name, input.website_url, input.business_type, input.business_location, input.contact_name, input.contact_email, input.contact_phone ?? null]
    );

    if (input.login_password) {
      const hash = await bcrypt.hash(input.login_password, 12);
      await connection.query(
        `INSERT INTO users(email,password_hash,role,client_id) VALUES($1,$2,'client',$3)`,
        [input.contact_email, hash, created.rows[0].id]
      );
    }

    await connection.query("COMMIT");
    return created.rows[0];
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateClient(id: string, input: Partial<{ name: string; website_url: string; business_type: string; business_location: string; contact_name: string; contact_email: string; contact_phone: string | null; }>) {
  const rows = Object.entries(input).filter(([, value]) => value !== undefined && value !== null);
  if (!rows.length) {
    return null;
  }

  const setClauses = rows.map(([key], index) => `${key}=$${index + 1}`).join(", ");
  const values = rows.map(([, value]) => value);
  values.push(id);

  const result = await db().query(
    `UPDATE clients SET ${setClauses}, updated_at=now() WHERE id=$${rows.length + 1} RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}

export async function deleteClient(id: string) {
  const result = await db().query("DELETE FROM clients WHERE id=$1 RETURNING id", [id]);
  return (result.rowCount ?? 0) > 0;
}

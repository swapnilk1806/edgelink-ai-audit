import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import { generateToken } from "../middleware/auth";

export async function loginUser(email: string, password: string) {
  const result = await db().query(
    `SELECT id, email, password_hash, role, client_id FROM users WHERE lower(email)=lower($1) AND is_active=true LIMIT 1`,
    [email]
  );
  const user = result.rows[0];
  if (!user) return null;
  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) return null;

  const authUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    clientId: user.client_id
  };

  return {
    user: authUser,
    token: generateToken(authUser)
  };
}

export async function getCurrentUser(userId: string) {
  const result = await db().query(
    `SELECT id, email, role, client_id FROM users WHERE id=$1 AND is_active=true LIMIT 1`,
    [userId]
  );
  return result.rowCount ? result.rows[0] : null;
}

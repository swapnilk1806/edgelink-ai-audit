import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@backend/lib/db";

const COOKIE_NAME = "edgelink_session";
type Session = { userId: string; role: "admin" | "client"; clientId: string | null; email: string };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(value);
}

export async function setSession(session: Session) {
  const token = await new SignJWT(session).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("12h").sign(secret());
  cookies().set(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 43200 });
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.userId !== "string" || (payload.role !== "admin" && payload.role !== "client")) return null;
    return {
      userId: payload.userId,
      role: payload.role,
      clientId: typeof payload.clientId === "string" ? payload.clientId : null,
      email: typeof payload.email === "string" ? payload.email : ""
    };
  } catch {
    return null;
  }
}

export async function requireRole(role: Session["role"]) {
  const session = await getSession();
  if (!session || session.role !== role) throw new Error("Unauthorized");
  return session;
}

export async function authenticate(email: string, password: string): Promise<Session | null> {
  const result = await db().query(
    `SELECT id, email, password_hash, role, client_id FROM users WHERE lower(email) = lower($1) AND is_active = true`,
    [email]
  );
  const user = result.rows[0];
  if (!user || !(await (await import("bcryptjs")).compare(password, user.password_hash))) return null;
  return { userId: user.id, role: user.role, clientId: user.client_id, email: user.email };
}

export function clearSession() {
  cookies().delete(COOKIE_NAME);
}

import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "../lib/db";
import { config } from "../config/app";

export type AuthUser = {
  id: string;
  email: string;
  role: "admin" | "client";
  clientId: string | null;
};

type JwtPayload = {
  userId: string;
  role: "admin" | "client";
  clientId?: string | null;
  email: string;
};

export function generateToken(user: AuthUser) {
  return jwt.sign({ userId: user.id, role: user.role, clientId: user.clientId, email: user.email }, config.jwtSecret, {
    expiresIn: "12h"
  });
}

export async function getAuthenticatedUserFromRequest(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  try {
    const token = authHeader.slice("Bearer ".length);
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const user = await db().query(
      `SELECT id, email, role, client_id FROM users WHERE id=$1 AND is_active=true LIMIT 1`,
      [payload.userId]
    );
    if (!user.rowCount) return null;
    const record = user.rows[0];
    return {
      id: record.id,
      email: record.email,
      role: record.role,
      clientId: record.client_id
    } satisfies AuthUser;
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await getAuthenticatedUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  (req as Request & { user?: AuthUser }).user = user;
  return next();
}

export function requireRole(role: "admin" | "client") {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user?: AuthUser }).user;
    if (!user || user.role !== role) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}

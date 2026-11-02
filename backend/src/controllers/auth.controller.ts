import type { Request, Response } from "express";
import { z } from "zod";
import { loginUser, getCurrentUser } from "../services/auth.service";
import { getAuthenticatedUserFromRequest } from "../middleware/auth";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export async function loginController(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid credentials" });
  }

  const result = await loginUser(parsed.data.email, parsed.data.password);
  if (!result) {
    return res.status(401).json({ error: "Email or password is incorrect" });
  }

  return res.json({
    token: result.token,
    user: result.user
  });
}

export async function meController(req: Request, res: Response) {
  const user = await getAuthenticatedUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const current = await getCurrentUser(user.id);
  if (!current) return res.status(401).json({ error: "Unauthorized" });
  return res.json({ user: current });
}

export async function logoutController(_req: Request, res: Response) {
  return res.json({ success: true });
}

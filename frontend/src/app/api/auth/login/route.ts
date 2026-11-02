import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, setSession } from "@/lib/auth";
import { withApiErrors } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const POST = withApiErrors("auth.login", async (request: Request) => {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Enter a valid email and password" }, { status: 400 });
  const session = await authenticate(body.data.email, body.data.password);
  if (!session) return NextResponse.json({ error: "Email or password is incorrect" }, { status: 401 });
  await setSession(session);
  return NextResponse.json({ redirect: session.role === "admin" ? "/admin" : "/client/dashboard" });
});

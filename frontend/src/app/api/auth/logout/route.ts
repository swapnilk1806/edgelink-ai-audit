import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { withApiErrors } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export const POST = withApiErrors("auth.logout", async () => {
  clearSession();
  return NextResponse.json({ ok: true });
});

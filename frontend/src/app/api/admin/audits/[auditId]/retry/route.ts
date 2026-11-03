import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { retryAudit } from "@backend/services/audits.service";
import { withApiErrors } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = withApiErrors(
  "admin.audits.retry",
  async (_request: Request, { params }: { params: { auditId: string } }) => {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      return NextResponse.json(await retryAudit(params.auditId), { status: 202 });
    } catch (error) {
      if (error instanceof Error && "statusCode" in error && typeof error.statusCode === "number") {
        return NextResponse.json({ error: error.message }, { status: error.statusCode });
      }
      throw error;
    }
  }
);

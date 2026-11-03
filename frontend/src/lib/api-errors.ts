import { NextResponse } from "next/server";

type ApiHandler<Args extends unknown[]> = (...args: Args) => Promise<NextResponse>;

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return undefined;
}

export function withApiErrors<Args extends unknown[]>(operation: string, handler: ApiHandler<Args>): ApiHandler<Args> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      const requestId = crypto.randomUUID();
      console.error(`[api:${operation}] request ${requestId} failed`, error);
      const code = getErrorCode(error);
      const errorText = error instanceof Error ? error.message : "";
      const message =
        errorText.includes("UPSTASH_REDIS_URL")
          ? errorText
          : code === "28P01" || code === "28000"
          ? "Database authentication failed. Verify the username and password in DATABASE_URL."
          : code === "42P01" || code === "3F000"
            ? "The database schema is missing. Run npm run db:migrate from the backend directory."
            : "The server could not complete this request. Please try again.";
      return NextResponse.json(
        { error: message, request_id: requestId },
        { status: 500 }
      );
    }
  };
}

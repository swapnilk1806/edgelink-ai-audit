import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const fallbackJwtSecret = "development-secret-change-me-please-32-chars";
const fallbackFrontendUrl = "http://localhost:3000";

export const config = {
  env: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  apiBase: "/api",
  jwtSecret: process.env.JWT_SECRET ?? process.env.SESSION_SECRET ?? fallbackJwtSecret,
  sessionSecret: process.env.SESSION_SECRET ?? process.env.JWT_SECRET ?? fallbackJwtSecret,
  clientUrl: process.env.FRONTEND_URL ?? process.env.APP_URL ?? fallbackFrontendUrl,
  frontendUrl: process.env.FRONTEND_URL ?? process.env.APP_URL ?? fallbackFrontendUrl,
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? process.env.UPSTASH_REDIS_URL ?? "",
  reportsDir: process.env.REPORTS_DIR ?? process.env.REPORT_STORAGE_DIR ?? "./tmp/reports",
  queueName: process.env.QUEUE_NAME ?? "seo-audit-jobs",
  jwt: {
    secret: process.env.JWT_SECRET ?? process.env.SESSION_SECRET ?? fallbackJwtSecret
  }
};

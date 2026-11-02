import { z } from "zod";
import { config } from "./app";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).optional(),
  UPSTASH_REDIS_URL: z.string().min(1).optional(),
  QUEUE_NAME: z.string().min(1).default("seo-audit-jobs"),
  JWT_SECRET: z.string().min(32).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  FRONTEND_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),
  REPORTS_DIR: z.string().min(1).default("./tmp/reports"),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_PASSWORD: z.string().min(8).optional(),
  USE_MOCKS: z.enum(["true", "false"]).default("true")
});

export function getValidatedEnv() {
  const input = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV ?? config.env,
    PORT: process.env.PORT ?? String(config.port),
    DATABASE_URL: process.env.DATABASE_URL ?? config.databaseUrl,
    REDIS_URL: process.env.REDIS_URL ?? process.env.UPSTASH_REDIS_URL,
    UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL ?? process.env.REDIS_URL,
    QUEUE_NAME: process.env.QUEUE_NAME ?? config.queueName,
    JWT_SECRET: process.env.JWT_SECRET ?? process.env.SESSION_SECRET ?? config.jwtSecret,
    SESSION_SECRET: process.env.SESSION_SECRET ?? process.env.JWT_SECRET ?? config.sessionSecret,
    FRONTEND_URL: process.env.FRONTEND_URL ?? process.env.APP_URL ?? config.frontendUrl,
    APP_URL: process.env.APP_URL ?? process.env.FRONTEND_URL ?? config.clientUrl,
    REPORTS_DIR: process.env.REPORTS_DIR ?? process.env.REPORT_STORAGE_DIR ?? config.reportsDir,
    USE_MOCKS: process.env.USE_MOCKS ?? "true"
  };

  const parsed = envSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((issue) => issue.path.join(".") || issue.message).join(", ")}`);
  }

  return parsed.data;
}

export const env = getValidatedEnv();

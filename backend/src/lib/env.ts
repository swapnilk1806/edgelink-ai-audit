import { z } from "zod";
import { getRedisConnectionOptions } from "@backend/lib/redis-connection";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  UPSTASH_REDIS_URL: z.string().min(1),
  GEMINI_API_KEY: z.string().optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  REPORT_STORAGE_DIR: z.string().default("./reports")
});

export function getEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const invalidFields = parsed.error.issues.map((issue) => issue.path.join("."));
    if (invalidFields.includes("UPSTASH_REDIS_URL")) {
      throw new Error(
        "UPSTASH_REDIS_URL is missing. Set it to the Upstash Redis TCP URL (rediss://default:<token>@<endpoint>:6379); the HTTPS REST URL/token will not work with BullMQ."
      );
    }
    throw new Error(`Invalid environment configuration: ${invalidFields.join(", ")}`);
  }
  getRedisConnectionOptions(parsed.data.UPSTASH_REDIS_URL);
  return parsed.data;
}

function readUseMocks() {
  const value = process.env.USE_MOCKS?.trim().toLowerCase();
  if (!value) return true;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("USE_MOCKS must be either true or false");
}

export const useMocks = readUseMocks();

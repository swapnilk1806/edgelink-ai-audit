import { Pool } from "pg";

const globalForPg = globalThis as typeof globalThis & { pgPool?: Pool };

export function db() {
  if (!globalForPg.pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required");
    const sslSetting = process.env.DATABASE_SSL?.toLowerCase();
    if (sslSetting && !["true", "false", "auto"].includes(sslSetting)) {
      throw new Error("DATABASE_SSL must be true, false, or auto");
    }
    const hostname = new URL(connectionString).hostname.toLowerCase();
    const isLocalDatabase = ["localhost", "127.0.0.1", "::1"].includes(hostname);
    const useSsl = sslSetting === "true" || (sslSetting !== "false" && sslSetting !== "true" && process.env.NODE_ENV === "production" && !isLocalDatabase);
    globalForPg.pgPool = new Pool({
      connectionString,
      max: 10,
      ssl: useSsl ? { rejectUnauthorized: true } : undefined
    });
  }
  return globalForPg.pgPool;
}

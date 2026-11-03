import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { readdir, readFile } from "node:fs/promises";
import { db } from "@backend/lib/db";

async function migrate() {
  const pool = db();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const migrationsUrl = new URL("./migrations/", import.meta.url);
    const migrationFiles = (await readdir(migrationsUrl))
      .filter((name) => /^\d+_.+\.sql$/.test(name))
      .sort();

    for (const name of migrationFiles) {
      const alreadyApplied = await client.query(
        "SELECT 1 FROM schema_migrations WHERE name=$1",
        [name]
      );
      if (alreadyApplied.rowCount) {
        if (name !== "002_notification_deliveries.sql") continue;
        const table = await client.query(
          "SELECT to_regclass('public.notification_deliveries') IS NOT NULL AS table_exists"
        );
        if (table.rows[0].table_exists) continue;
        await client.query("DELETE FROM schema_migrations WHERE name=$1", [name]);
        console.warn("Notification migration is recorded but its table is missing; reapplying it.");
      }

      let transactionStarted = false;
      try {
        await client.query("BEGIN");
        transactionStarted = true;
        const sql = await readFile(new URL(name, migrationsUrl), "utf8");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
        await client.query("COMMIT");
        transactionStarted = false;
        console.info(`Applied database migration ${name}`);
      } catch (error) {
        if (transactionStarted) await client.query("ROLLBACK");
        throw error;
      }
    }

    const notificationTable = await client.query(
      "SELECT to_regclass('public.notification_deliveries') IS NOT NULL AS table_exists"
    );
    if (!notificationTable.rows[0].table_exists) {
      throw new Error("Migration completed, but public.notification_deliveries is still missing from the configured database.");
    }
    console.info("Database migrations are up to date; notification_deliveries exists.");
  } finally {
    client.release();
    await pool.end();
  }
}

void migrate().catch((error: unknown) => {
  console.error("Database migration failed", error);
  process.exitCode = 1;
});

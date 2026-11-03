import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { readFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { db } from "@backend/lib/db";

async function seed() {
  const migration = await readFile(new URL("./migrations/001_initial.sql", import.meta.url), "utf8");
  await db().query(migration);
  const notificationsMigration = await readFile(new URL("./migrations/002_notification_deliveries.sql", import.meta.url), "utf8");
  await db().query(notificationsMigration);
  const password = process.env.SEED_PASSWORD;
  const email = process.env.SEED_ADMIN_EMAIL;
  if (!password || !email) throw new Error("Set SEED_ADMIN_EMAIL and SEED_PASSWORD before running the seed command");
  const hash = await bcrypt.hash(password, 12);
  await db().query(
    `INSERT INTO users (email,password_hash,role) VALUES ($1,$2,'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash,role='admin',client_id=NULL,is_active=true`,
    [email, hash]
  );
  console.info(`Admin account ready: ${email}`);
  const sampleEmail = process.env.SEED_SAMPLE_CLIENT_EMAIL;
  const samplePassword = process.env.SEED_SAMPLE_CLIENT_PASSWORD;
  if (sampleEmail && samplePassword) {
    const existing = await db().query("SELECT id FROM users WHERE lower(email)=lower($1)", [sampleEmail]);
    if (!existing.rowCount) {
      const sampleClient = await db().query(
        `INSERT INTO clients(name,website_url,business_type,business_location,contact_name,contact_email)
         VALUES('Sample SEO Client','https://example.com','Sample business','Sample location','Sample contact',$1) RETURNING id`,
        [sampleEmail]
      );
      await db().query(
        "INSERT INTO users(email,password_hash,role,client_id) VALUES($1,$2,'client',$3)",
        [sampleEmail, await bcrypt.hash(samplePassword, 12), sampleClient.rows[0].id]
      );
      console.info(`Sample client account ready: ${sampleEmail}`);
    } else {
      console.info(`Sample client account already exists: ${sampleEmail}`);
    }
  }
  await db().end();
}

seed().catch((error) => { console.error(error); process.exitCode = 1; });

import type { Request, Response } from "express";
import { readFile } from "node:fs/promises";
import { db } from "../lib/db";

export const reportsController = {
  async getReport(req: Request, res: Response) {
    const user = (req as Request & { user?: { id: string; clientId: string | null; role: string } }).user;
    const report = await db().query(
      `SELECT p.storage_path, a.client_id, a.website_url, r.result_json
       FROM audit_reports p
       JOIN audits a ON a.id = p.audit_id
       LEFT JOIN audit_results r ON r.audit_id = a.id
       WHERE p.audit_id=$1`,
      [req.params.id]
    );

    if (!report.rowCount) return res.status(404).json({ error: "Report not found" });
    const item = report.rows[0];
    if (user && user.role === "client" && item.client_id !== user.clientId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const file = await readFile(item.storage_path);
      return res.type("application/pdf").attachment(`seo-audit-${req.params.id}.pdf`).send(file);
    } catch {
      return res.status(404).json({ error: "Report file is unavailable" });
    }
  }
};

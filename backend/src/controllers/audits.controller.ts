import type { Request, Response } from "express";
import { z } from "zod";
import { createAudit, listAudits, listClientAudits, retryAudit } from "../services/audits.service";
import { db } from "../lib/db";

const auditSchema = z.object({
  client_id: z.string().uuid(),
  website_url: z.string().url()
});

export const auditsController = {
  async list(_req: Request, res: Response) {
    const audits = await listAudits();
    return res.json(audits);
  },

  async getById(req: Request, res: Response) {
    const audits = await listAudits();
    const audit = audits.find((entry) => entry.id === req.params.id);
    if (!audit) return res.status(404).json({ error: "Audit not found" });
    return res.json(audit);
  },

  async create(req: Request, res: Response) {
    const parsed = auditSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid audit request" });
    }

    const user = (req as Request & { user?: { id: string } }).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    try {
      const result = await createAudit(parsed.data.client_id, parsed.data.website_url, user.id);
      return res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error && "statusCode" in error && typeof error.statusCode === "number" ? "Client not found" : "Unable to create audit";
      const status = error instanceof Error && "statusCode" in error && typeof error.statusCode === "number" ? Number(error.statusCode) : 500;
      return res.status(status).json({ error: message });
    }
  },

  async getStatus(req: Request, res: Response) {
    const row = await db().query("SELECT status, progress, error_message FROM audits WHERE id=$1", [req.params.id]);
    if (!row.rowCount) return res.status(404).json({ error: "Audit not found" });
    return res.json(row.rows[0]);
  },

  async getResults(req: Request, res: Response) {
    const row = await db().query("SELECT result_json FROM audit_results WHERE audit_id=$1", [req.params.id]);
    if (!row.rowCount) return res.status(404).json({ error: "Audit results not found" });
    return res.json(row.rows[0].result_json);
  },

  async retry(req: Request, res: Response) {
    const auditId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      return res.status(202).json(await retryAudit(auditId));
    } catch (error) {
      const status = error instanceof Error && "statusCode" in error && typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
      const message = status === 404 || status === 409
        ? error instanceof Error ? error.message : "Unable to retry audit"
        : "Unable to retry audit";
      return res.status(status).json({ error: message });
    }
  },

  async listForClient(req: Request, res: Response) {
    const clientId = (req as Request & { user?: { clientId: string | null } }).user?.clientId;
    if (!clientId) return res.status(403).json({ error: "Forbidden" });
    return res.json(await listClientAudits(clientId));
  }
};


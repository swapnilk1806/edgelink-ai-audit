import type { Request, Response } from "express";
import { z } from "zod";
import { createClient, deleteClient, listClients, updateClient } from "../services/clients.service";

const clientSchema = z.object({
  name: z.string().trim().min(1).max(150),
  website_url: z.string().url(),
  business_type: z.string().trim().min(1).max(150),
  business_location: z.string().trim().min(1).max(150),
  contact_name: z.string().trim().min(1).max(150),
  contact_email: z.string().email(),
  contact_phone: z.string().max(40).optional().nullable(),
  login_password: z.string().min(10).optional()
});

export const clientsController = {
  async list(_req: Request, res: Response) {
    const clients = await listClients();
    return res.json(clients);
  },

  async getById(req: Request, res: Response) {
    const clientId = String(req.params.id ?? "");
    const client = await listClients();
    const item = client.find((entry) => entry.id === clientId);
    if (!item) return res.status(404).json({ error: "Client not found" });
    return res.json(item);
  },

  async create(req: Request, res: Response) {
    const parsed = clientSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid client details" });
    }

    try {
      const item = await createClient(parsed.data);
      return res.status(201).json(item);
    } catch (error) {
      const message = error instanceof Error && "code" in error && error.code === "23505" ? "A user with that email already exists" : "Unable to create client";
      return res.status(409).json({ error: message });
    }
  },

  async update(req: Request, res: Response) {
    const parsed = clientSchema.partial().safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid client update" });
    }

    const clientId = String(req.params.id ?? "");
    const item = await updateClient(clientId, parsed.data);
    if (!item) return res.status(404).json({ error: "Client not found" });
    return res.json(item);
  },

  async remove(req: Request, res: Response) {
    const clientId = String(req.params.id ?? "");
    const ok = await deleteClient(clientId);
    if (!ok) return res.status(404).json({ error: "Client not found" });
    return res.status(204).send();
  }
};

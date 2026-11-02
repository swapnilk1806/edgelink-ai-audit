import type { Request, Response } from "express";
import { getDashboardStats } from "../services/dashboard.service";

export const dashboardController = {
  async getStats(_req: Request, res: Response) {
    const stats = await getDashboardStats();
    return res.json(stats);
  },

  async getRecentAudits(_req: Request, res: Response) {
    const stats = await getDashboardStats();
    return res.json(stats.recent);
  }
};

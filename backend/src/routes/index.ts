import { Router } from "express";
import { loginController, meController, logoutController } from "../controllers/auth.controller";
import { dashboardController } from "../controllers/dashboard.controller";
import { clientsController } from "../controllers/clients.controller";
import { auditsController } from "../controllers/audits.controller";
import { reportsController } from "../controllers/reports.controller";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.post("/auth/login", loginController);
router.post("/auth/logout", logoutController);
router.get("/auth/me", requireAuth, meController);

router.get("/dashboard/stats", requireAuth, requireRole("admin"), dashboardController.getStats);
router.get("/dashboard/recent-audits", requireAuth, requireRole("admin"), dashboardController.getRecentAudits);

router.get("/clients", requireAuth, requireRole("admin"), clientsController.list);
router.get("/clients/:id", requireAuth, requireRole("admin"), clientsController.getById);
router.post("/clients", requireAuth, requireRole("admin"), clientsController.create);
router.patch("/clients/:id", requireAuth, requireRole("admin"), clientsController.update);
router.delete("/clients/:id", requireAuth, requireRole("admin"), clientsController.remove);

router.get("/audits", requireAuth, requireRole("admin"), auditsController.list);
router.get("/audits/:id", requireAuth, requireRole("admin"), auditsController.getById);
router.post("/audits", requireAuth, requireRole("admin"), auditsController.create);
router.get("/audits/:id/status", requireAuth, auditsController.getStatus);
router.get("/audits/:id/results", requireAuth, auditsController.getResults);
router.post("/audits/:id/retry", requireAuth, requireRole("admin"), auditsController.retry);

router.get("/reports/:id", requireAuth, reportsController.getReport);

export default router;

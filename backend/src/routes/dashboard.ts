import { Router } from "express";
import { getDashboardKpis, getDashboardTrend } from "../services/dashboard-service.js";

export const dashboardRouter = Router();

dashboardRouter.get("/dashboard/kpis", async (req, res) => {
  try {
    const kpis = await getDashboardKpis(req.user?.role ?? null);
    res.json(kpis);
  } catch (err) {
    res.status(500).json({ error: "dashboard_kpis_fetch_failed", message: (err as Error).message });
  }
});

dashboardRouter.get("/dashboard/trend", async (req, res) => {
  try {
    const trend = await getDashboardTrend(req.user?.role ?? null);
    res.json(trend);
  } catch (err) {
    res.status(500).json({ error: "dashboard_trend_fetch_failed", message: (err as Error).message });
  }
});

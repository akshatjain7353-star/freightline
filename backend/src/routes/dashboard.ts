import { Router } from "express";
import { sendUnexpectedError } from "../lib/http-error.js";
import { getDashboardKpis, getDashboardTrend } from "../services/dashboard-service.js";

export const dashboardRouter = Router();

dashboardRouter.get("/dashboard/kpis", async (req, res) => {
  try {
    const kpis = await getDashboardKpis(req.user?.role ?? null);
    res.json(kpis);
  } catch (err) {
    sendUnexpectedError(res, err, "dashboard_kpis_fetch_failed", "Could not load dashboard KPIs.");
  }
});

dashboardRouter.get("/dashboard/trend", async (req, res) => {
  try {
    const trend = await getDashboardTrend(req.user?.role ?? null);
    res.json(trend);
  } catch (err) {
    sendUnexpectedError(res, err, "dashboard_trend_fetch_failed", "Could not load dashboard trend.");
  }
});

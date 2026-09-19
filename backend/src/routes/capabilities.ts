import { Router } from "express";
import { env, isDelhiveryConfigured } from "../config/env.js";
import { publicFeatureCatalog } from "../lib/feature-readiness.js";

export const capabilitiesRouter = Router();

capabilitiesRouter.get("/capabilities", (_req, res) => {
  res.json({
    delhiveryConfigured: isDelhiveryConfigured(),
    delhiveryEnv: env.DELHIVERY_ENV,
    manualBookingEnabled: !isDelhiveryConfigured(),
    trackingPollerEnabled: isDelhiveryConfigured(),
    features: publicFeatureCatalog(),
  });
});

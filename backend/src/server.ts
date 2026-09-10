import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { rateCalculatorRouter } from "./routes/rate-calculator.js";
import { shipmentsRouter } from "./routes/shipments.js";
import { bulkUploadRouter } from "./routes/bulk-upload.js";
import { startTrackingPoller } from "./jobs/tracking-poller.js";

const app = express();

const allowedOrigins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "5mb" })); // bulk upload payloads can be sizable

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", rateCalculatorRouter);
app.use("/api", shipmentsRouter);
app.use("/api", bulkUploadRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "internal_error" });
});

app.listen(env.PORT, () => {
  console.log(`Freightline backend listening on port ${env.PORT}`);
  startTrackingPoller();
});

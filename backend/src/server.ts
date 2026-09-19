import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { requireAuth, requireOps } from "./middleware/auth.js";
import { clientPortalRouter } from "./routes/client-portal.js";
import { requireClientApiKey } from "./middleware/client-api-auth.js";
import { rateCalculatorRouter } from "./routes/rate-calculator.js";
import { shipmentsRouter } from "./routes/shipments.js";
import { bulkUploadRouter } from "./routes/bulk-upload.js";
import { rateCardsRouter } from "./routes/rate-cards.js";
import { serviceabilityRouter } from "./routes/serviceability.js";
import { weightDiscrepanciesRouter } from "./routes/weight-discrepancies.js";
import { pickupsRouter } from "./routes/pickups.js";
import { ndrRouter } from "./routes/ndr.js";
import { exceptionsRouter } from "./routes/exceptions.js";
import { invoicesRouter } from "./routes/invoices.js";
import { vendorInvoicesRouter } from "./routes/vendor-invoices.js";
import { clientRateCardsRouter } from "./routes/client-rate-cards.js";
import { cashReconciliationRouter } from "./routes/cash-reconciliation.js";
import { carrierRemittanceRouter } from "./routes/carrier-remittance.js";
import { clientLedgerRouter } from "./routes/client-ledger.js";
import { settlementsRouter } from "./routes/settlements.js";
import { dtoRequestsRouter } from "./routes/dto-requests.js";
import { clientApiKeysRouter } from "./routes/client-api-keys.js";
import { externalDtoRequestsRouter } from "./routes/external-dto-requests.js";
import { unicommerceShipperRouter } from "./routes/unicommerce-shipper.js";
import { unicommerceCredentialsRouter } from "./routes/unicommerce-credentials.js";
import { importMappingsRouter } from "./routes/import-mappings.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { capabilitiesRouter } from "./routes/capabilities.js";
import { startTrackingPoller } from "./jobs/tracking-poller.js";
import { isDelhiveryConfigured } from "./config/env.js";

const app = express();

const allowedOrigins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "5mb" })); // bulk upload payloads can be sizable

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Shipper portal first so /api/client/* is not treated as an ops route.
app.use("/api/client", requireAuth, clientPortalRouter);

// Every ops route requires a valid Supabase session *and* an internal role.
// Client-portal JWTs must not create bookings or read admin APIs.
app.use("/api", requireAuth, requireOps, rateCalculatorRouter);
app.use("/api", requireAuth, requireOps, shipmentsRouter);
app.use("/api", requireAuth, requireOps, bulkUploadRouter);
app.use("/api", requireAuth, requireOps, rateCardsRouter);
app.use("/api", requireAuth, requireOps, serviceabilityRouter);
app.use("/api", requireAuth, requireOps, weightDiscrepanciesRouter);
app.use("/api", requireAuth, requireOps, pickupsRouter);
app.use("/api", requireAuth, requireOps, ndrRouter);
app.use("/api", requireAuth, requireOps, exceptionsRouter);
app.use("/api", requireAuth, requireOps, invoicesRouter);
app.use("/api", requireAuth, requireOps, vendorInvoicesRouter);
app.use("/api", requireAuth, requireOps, clientRateCardsRouter);
app.use("/api", requireAuth, requireOps, cashReconciliationRouter);
app.use("/api", requireAuth, requireOps, carrierRemittanceRouter);
app.use("/api", requireAuth, requireOps, clientLedgerRouter);
app.use("/api", requireAuth, requireOps, settlementsRouter);
app.use("/api", requireAuth, requireOps, dtoRequestsRouter);
app.use("/api", requireAuth, requireOps, clientApiKeysRouter);
app.use("/api", requireAuth, requireOps, unicommerceCredentialsRouter);
app.use("/api", requireAuth, requireOps, importMappingsRouter);
app.use("/api", requireAuth, requireOps, dashboardRouter);
app.use("/api", requireAuth, requireOps, capabilitiesRouter);

// Client-facing surface: authenticated by a per-client API key
// (client-api-auth.ts), never an internal ops Supabase session.
app.use("/external/v1", requireClientApiKey, externalDtoRequestsRouter);

// Unicommerce shipper (courier-partner) surface: Uniware calls this
// directly, authenticated per-route by requireUnicommerceToken (not here at
// the router level, since /authToken itself must stay open).
app.use("/unicommerce", unicommerceShipperRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "internal_error" });
});

app.listen(env.PORT, () => {
  console.log(`Freightline backend listening on port ${env.PORT}`);
  if (isDelhiveryConfigured()) {
    startTrackingPoller();
  } else {
    console.log("[tracking-poller] skipped — DELHIVERY_API_KEY is not set");
  }
});

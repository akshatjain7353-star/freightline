import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { requireAuth } from "./middleware/auth.js";
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
import { startTrackingPoller } from "./jobs/tracking-poller.js";

const app = express();

const allowedOrigins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "5mb" })); // bulk upload payloads can be sizable

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Every route below requires a valid Supabase session — previously none did.
app.use("/api", requireAuth, rateCalculatorRouter);
app.use("/api", requireAuth, shipmentsRouter);
app.use("/api", requireAuth, bulkUploadRouter);
app.use("/api", requireAuth, rateCardsRouter);
app.use("/api", requireAuth, serviceabilityRouter);
app.use("/api", requireAuth, weightDiscrepanciesRouter);
app.use("/api", requireAuth, pickupsRouter);
app.use("/api", requireAuth, ndrRouter);
app.use("/api", requireAuth, exceptionsRouter);
app.use("/api", requireAuth, invoicesRouter);
app.use("/api", requireAuth, vendorInvoicesRouter);
app.use("/api", requireAuth, clientRateCardsRouter);
app.use("/api", requireAuth, cashReconciliationRouter);
app.use("/api", requireAuth, carrierRemittanceRouter);
app.use("/api", requireAuth, clientLedgerRouter);
app.use("/api", requireAuth, settlementsRouter);
app.use("/api", requireAuth, dtoRequestsRouter);
app.use("/api", requireAuth, clientApiKeysRouter);
app.use("/api", requireAuth, unicommerceCredentialsRouter);

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
  startTrackingPoller();
});

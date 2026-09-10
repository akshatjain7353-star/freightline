import type { CarrierAdapter } from "../../lib/types.js";
import { getRateQuote } from "./rate.js";
import { checkServiceability } from "./serviceability.js";
import { createShipment } from "./booking.js";
import { trackShipments } from "./tracking.js";

export const delhiveryAdapter: CarrierAdapter = {
  code: "delhivery",
  name: "Delhivery",
  getRateQuote,
  checkServiceability,
  createShipment,
  trackShipments,
};

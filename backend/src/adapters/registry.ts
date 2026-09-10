import type { CarrierAdapter } from "../lib/types.js";
import { delhiveryAdapter } from "./delhivery/index.js";

// Xpressbees/Ekart adapters register here once built, implementing the same
// CarrierAdapter interface — nothing else in the app needs to change.
const adapters: Record<string, CarrierAdapter> = {
  delhivery: delhiveryAdapter,
};

export function getCarrierAdapter(carrierCode: string): CarrierAdapter {
  const adapter = adapters[carrierCode];
  if (!adapter) {
    throw new Error(`No carrier adapter registered for code "${carrierCode}"`);
  }
  return adapter;
}

export function listCarrierAdapters(): CarrierAdapter[] {
  return Object.values(adapters);
}

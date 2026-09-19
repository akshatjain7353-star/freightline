import { Router } from "express";
import { z } from "zod";
import { sendError, sendUnexpectedError } from "../lib/http-error.js";
import { getColumnMapping, saveColumnMapping } from "../services/import-mapping-service.js";

export const importMappingsRouter = Router();

importMappingsRouter.get("/import-mappings/:importerKey", async (req, res) => {
  try {
    const mapping = await getColumnMapping(req.params.importerKey);
    res.json({ mapping });
  } catch (err) {
    sendUnexpectedError(res, err, "mapping_fetch_failed", "Could not load the saved column mapping.");
  }
});

const putSchema = z.object({ mapping: z.record(z.string(), z.string()) });

importMappingsRouter.put("/import-mappings/:importerKey", async (req, res) => {
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "Column mapping must be a field-to-header map.", {
      details: parsed.error.flatten(),
    });
  }
  try {
    await saveColumnMapping(req.params.importerKey, parsed.data.mapping);
    res.json({ ok: true });
  } catch (err) {
    sendUnexpectedError(res, err, "mapping_save_failed", "Could not save the column mapping.");
  }
});

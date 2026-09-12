import { Router } from "express";
import { z } from "zod";
import { getColumnMapping, saveColumnMapping } from "../services/import-mapping-service.js";

export const importMappingsRouter = Router();

importMappingsRouter.get("/import-mappings/:importerKey", async (req, res) => {
  try {
    const mapping = await getColumnMapping(req.params.importerKey);
    res.json({ mapping });
  } catch (err) {
    res.status(500).json({ error: "mapping_fetch_failed", message: (err as Error).message });
  }
});

const putSchema = z.object({ mapping: z.record(z.string(), z.string()) });

importMappingsRouter.put("/import-mappings/:importerKey", async (req, res) => {
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  try {
    await saveColumnMapping(req.params.importerKey, parsed.data.mapping);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "mapping_save_failed", message: (err as Error).message });
  }
});

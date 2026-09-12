import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/auth.js";
import { issueSellerCredentials, listSellerCredentials } from "../services/unicommerce-shipper-service.js";

export const unicommerceCredentialsRouter = Router();

unicommerceCredentialsRouter.use(requireRole("admin"));

unicommerceCredentialsRouter.get("/clients/:id/unicommerce-credentials", async (req, res) => {
  try {
    const credentials = await listSellerCredentials(req.params.id);
    res.json({ credentials });
  } catch (err) {
    res.status(500).json({ error: "credentials_fetch_failed", message: (err as Error).message });
  }
});

const issueSchema = z.object({ label: z.string().min(1) });

unicommerceCredentialsRouter.post("/clients/:id/unicommerce-credentials", async (req, res) => {
  const parsed = issueSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  try {
    const { credential, password } = await issueSellerCredentials(req.params.id, parsed.data.label, req.user?.id);
    res.status(201).json({ credential, username: credential.username, password });
  } catch (err) {
    res.status(500).json({ error: "credential_issuance_failed", message: (err as Error).message });
  }
});

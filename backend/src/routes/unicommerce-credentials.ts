import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/auth.js";
import { sendError, sendUnexpectedError } from "../lib/http-error.js";
import { issueSellerCredentials, listSellerCredentials } from "../services/unicommerce-shipper-service.js";

export const unicommerceCredentialsRouter = Router();

unicommerceCredentialsRouter.use(requireRole("admin"));

unicommerceCredentialsRouter.get("/clients/:id/unicommerce-credentials", async (req, res) => {
  try {
    const credentials = await listSellerCredentials(req.params.id);
    res.json({ credentials });
  } catch (err) {
    sendUnexpectedError(res, err, "credentials_fetch_failed", "Could not load Unicommerce credentials.");
  }
});

const issueSchema = z.object({ label: z.string().min(1) });

unicommerceCredentialsRouter.post("/clients/:id/unicommerce-credentials", async (req, res) => {
  const parsed = issueSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "A label is required to issue credentials.", {
      details: parsed.error.flatten(),
    });
  }
  try {
    const { credential, password } = await issueSellerCredentials(req.params.id, parsed.data.label, req.user?.id);
    res.status(201).json({ credential, username: credential.username, password });
  } catch (err) {
    sendUnexpectedError(res, err, "credential_issuance_failed", "Could not issue Unicommerce credentials.");
  }
});

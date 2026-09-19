import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Optional: Phase 1 rate-card quotes, local booking, and dashboard work
  // without a live Delhivery token. Live booking / tracking / serviceability
  // stay off until a real key is set — we do not invent one.
  DELHIVERY_API_KEY: z
    .string()
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value.trim() : undefined)),
  DELHIVERY_ENV: z.enum(["staging", "production"]).default("staging"),
  DELHIVERY_ZONE_API_PATH: z.string().optional(),

  TRACKING_POLL_INTERVAL_MINUTES: z.coerce.number().positive().default(15),

  PORT: z.coerce.number().default(8080),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration. Check .env against .env.example.");
  }
  return parsed.data;
}

export const env = loadEnv();

export const DELHIVERY_BASE_URLS = {
  staging: "https://staging-express.delhivery.com",
  production: "https://track.delhivery.com",
} as const;

export function delhiveryBaseUrl(): string {
  return DELHIVERY_BASE_URLS[env.DELHIVERY_ENV];
}

export function isDelhiveryConfigured(): boolean {
  return Boolean(env.DELHIVERY_API_KEY);
}

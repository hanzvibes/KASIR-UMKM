import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url().optional(),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    SENTRY_DSN: process.env.SENTRY_DSN || undefined,
  });
}

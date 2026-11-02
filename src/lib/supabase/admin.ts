import { createServerClient } from "@supabase/ssr";

/**
 * Service-role client for the daily cron job. It skips row-level security,
 * so every query made with it must filter by user_id. Never use it in pages.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

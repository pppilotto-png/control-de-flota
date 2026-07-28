import { createClient } from "@supabase/supabase-js";

const url =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url ?? "http://127.0.0.1:54321", key ?? "build-placeholder", {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const STATE_KEY = "fretecontrol-erp-state";
export const FILE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "fretecontrol-files";

export async function readState(): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("app_storage")
    .select("value")
    .eq("key", STATE_KEY)
    .eq("shared", true)
    .maybeSingle();
  if (error) throw error;
  if (!data?.value) return null;
  return typeof data.value === "string" ? JSON.parse(data.value) : data.value;
}

export async function writeState(state: Record<string, unknown>) {
  const { error } = await supabase.from("app_storage").upsert(
    { key: STATE_KEY, value: JSON.stringify(state), shared: true },
    { onConflict: "key,shared" },
  );
  if (error) throw error;
}

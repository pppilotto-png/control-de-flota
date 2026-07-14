/*
 * Este archivo reemplaza el "window.storage" que usa la app dentro de Claude
 * por una conexión real a Supabase. El resto del código (App.jsx) no necesita
 * ningún cambio: sigue llamando a window.storage.get/set exactamente igual.
 *
 * Necesita dos variables de entorno (las configurás en Vercel):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Faltan las variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
    "Configuralas en Vercel (Settings > Environment Variables) y volvé a desplegar."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);
const TABLE = "app_storage";

async function get(key, shared = false) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("key, value, shared")
    .eq("key", key)
    .eq("shared", shared)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function set(key, value, shared = false) {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert({ key, value, shared }, { onConflict: "key,shared" })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data || { key, value, shared };
}

async function del(key, shared = false) {
  const { error } = await supabase.from(TABLE).delete().eq("key", key).eq("shared", shared);
  if (error) throw error;
  return { key, deleted: true, shared };
}

async function list(prefix = "", shared = false) {
  let query = supabase.from(TABLE).select("key").eq("shared", shared);
  if (prefix) query = query.like("key", `${prefix}%`);
  const { data, error } = await query;
  if (error) throw error;
  return { keys: (data || []).map((d) => d.key), prefix, shared };
}

window.storage = { get, set, delete: del, list };

/*
 * window.auth: login con usuario (email) y contraseña, usando Supabase Auth.
 * Necesario para que la pantalla de Login de la app funcione.
 * Creá el usuario en Supabase → Authentication → Users → Add user.
 */
window.auth = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  },
  async signOut() {
    await supabase.auth.signOut();
  },
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },
  onAuthChange(callback) {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
    return () => listener.subscription.unsubscribe();
  },
};

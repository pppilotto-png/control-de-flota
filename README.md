# Control de Flota — guía para publicarlo sin Claude

Esta carpeta es tu app lista para vivir en internet, fuera de Claude, gratis.
Vas a necesitar crear 3 cuentas gratuitas (Supabase, GitHub, Vercel) y seguir
estos pasos una sola vez. Después, cada vez que quieras un cambio, me lo pedís
acá y yo te doy el archivo actualizado para volver a subir.

---

## Paso 1 — Crear la base de datos (Supabase)

1. Entrá a https://supabase.com y creá una cuenta gratis (podés usar tu cuenta de Google).
2. Creá un **New project**. Elegí cualquier nombre (ej: "control-de-flota") y una
   contraseña para la base (guardala, por las dudas).
3. Esperá 1-2 minutos a que el proyecto termine de crearse.
4. En el menú izquierdo andá a **SQL Editor** → **New query**, pegá esto y
   apretá **Run**:

   ```sql
   create table app_storage (
     key text not null,
     value text,
     shared boolean not null default false,
     primary key (key, shared)
   );

   alter table app_storage enable row level security;

   create policy "Acceso anónimo total"
   on app_storage
   for all
   using (true)
   with check (true);
   ```

   > ⚠️ Esta política deja la tabla abierta a quien tenga el link de tu app.
   > Como es una herramienta interna (no la vas a publicitar ni indexar en Google),
   > es un punto de partida razonable. Si más adelante querés que pida usuario y
   > contraseña, avisame y lo agregamos.

5. Andá a **Project Settings** (ícono de tuerca) → **API**. Ahí vas a ver:
   - **Project URL** (algo como `https://xxxxx.supabase.co`)
   - **anon public key** (una clave larga)

   Copiá esos dos valores, los vas a necesitar en el Paso 3.

---

## Paso 2 — Subir el código a GitHub

1. Entrá a https://github.com y creá una cuenta gratis.
2. Arriba a la derecha, tocá **+** → **New repository**. Nombre: `control-de-flota`.
   Dejalo en **Public** o **Private** (cualquiera funciona) y creá el repositorio
   (no marques ninguna casilla de "add README").
3. En la página del repositorio recién creado, tocá **uploading an existing file**.
4. Arrastrá **todos los archivos y carpetas de esta carpeta del proyecto**
   (incluida la carpeta `src`) y confirmá el commit ("Commit changes").

---

## Paso 3 — Publicar en internet (Vercel)

1. Entrá a https://vercel.com y creá una cuenta gratis con tu usuario de GitHub
   (botón "Continue with GitHub").
2. Tocá **Add New... → Project**, y elegí el repositorio `control-de-flota`
   que subiste recién.
3. Vercel va a detectar solo que es un proyecto Vite. Antes de tocar "Deploy",
   abrí **Environment Variables** y agregá:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | el Project URL que copiaste en el Paso 1 |
   | `VITE_SUPABASE_ANON_KEY` | el anon public key que copiaste en el Paso 1 |

4. Tocá **Deploy** y esperá 1-2 minutos.
5. Cuando termine, Vercel te da un link (algo como `control-de-flota.vercel.app`).
   Ese es tu sistema, ya funcionando en internet, sin depender de Claude.

---

## Cómo actualizarlo más adelante

Cuando quieras que te agregue o cambie algo, hacé el pedido acá en el chat.
Te voy a dar el archivo `App.jsx` actualizado (u otros archivos si hace falta).
Vos solo tenés que:

1. Ir a tu repositorio en GitHub.
2. Entrar a la carpeta/archivo que cambió.
3. Tocar el lápiz (✏️ Edit) o "Upload files" para reemplazarlo por el nuevo.
4. Confirmar el cambio ("Commit changes").

Vercel vuelve a publicar solo, automáticamente, un par de minutos después.

---

## Nota sobre tus datos actuales

Los datos que ya cargaste (vehículos, viajes, pedidos, etc.) viven adentro de
Claude ahora mismo. Al pasar a Supabase, el sistema arranca vacío (con los
vehículos de ejemplo de tu planilla original). Si querés, puedo prepararte
un archivo para migrar tus datos actuales a Supabase — avisame antes de hacer
el cambio definitivo.

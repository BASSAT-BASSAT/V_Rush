# Production checklist

Do these once before (or right after) your first deploy. Dashboard steps need **your** Supabase and Vercel logins—only you can complete them.

## 1. Supabase — database and auth

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. **SQL Editor** → New query → paste the full contents of  
   [`supabase/migrations/20260415120000_kernellab_auth.sql`](../supabase/migrations/20260415120000_kernellab_auth.sql) → **Run**.
3. **Authentication → Providers:** ensure **Email** is enabled if you use email/password sign-in.
4. **Authentication → URL configuration:**
   - **Site URL:** your production site, e.g. `https://YOUR_PROJECT.vercel.app` (or your custom domain).
   - **Redirect URLs:** add the same URL(s), wildcard `https://*.vercel.app/**` for preview deploys, and optionally `http://localhost:5173/**` for local dev.

### Terminal: update Site URL + redirects (Management API)

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."   # https://supabase.com/dashboard/account/tokens
.\scripts\set-supabase-auth-urls.ps1 -ProjectRef "YOUR_PROJECT_REF" -SiteUrl "https://YOUR_DEPLOYMENT.vercel.app"
```

`Project ref` is the host label from `https://YOUR_REF.supabase.co` (not the full URL).

### Terminal: link CLI and push migrations

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

(`db push` applies SQL under `supabase/migrations/` to the linked remote project. Run from the repo root.)

## 2. Sign-in works on Vercel (common fixes)

1. **Build-time env:** Vite bakes `VITE_*` in at **build time**. In Vercel → Project → Settings → Environment Variables, set **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`** for **Production**, then **Redeploy** (or “Redeploy with existing Build Cache” cleared) so the new bundle contains them. If either is missing in the client, sign-in throws before reaching Supabase.
2. **Supabase Auth URLs:** **Site URL** and **Redirect URLs** must include your live app origin (see [§1](#1-supabase--database-and-auth) above, or the terminal script there).
3. **Email confirmation:** If sign-up succeeds but sign-in says **email not confirmed**, confirm the message from your inbox, or temporarily adjust confirmation settings in Supabase (Auth → Providers → Email) for testing only.
4. **API after login:** If the UI shows signed in but pipeline fails, set **`CORS_ORIGINS`** on the API to include your `https://…vercel.app` origin and ensure **`SUPABASE_JWT_SECRET`** matches the project JWT secret.

## 3. Environment file (`kernellab.env`)

1. Fill [`kernellab.env`](../kernellab.env) (or copy from [`kernellab.env.example`](../kernellab.env.example)) with values from **Supabase → Project Settings → API** (URL, anon key, JWT secret).
2. **`CORS_ORIGINS`:** keep localhost entries for dev. After you know your live URL, **append** a comma and your production origin, e.g.  
   `http://localhost:5173,http://127.0.0.1:5173,https://YOUR_PROJECT.vercel.app`  
   (no spaces after commas; no path after the host.)

## 4. Vercel

**Recommended — all on Vercel (Services)** — repo root [`vercel.json`](../vercel.json)

- **Root Directory:** `.` (repository root), **not** `frontend`.
- **Framework:** **Services** (detected from `experimentalServices`).
- **Frontend** service (Vite): set all `VITE_*` variables. Use **`VITE_API_BASE_URL` empty** so the app calls same-origin `/api/...`.
- **Backend** service (FastAPI): `SUPABASE_JWT_SECRET`, `CORS_ORIGINS` (include your `https://….vercel.app`), optional `KERNELLAB_AUTH_DISABLED`, `MAX_*`.

Redeploy after changing environment variables (Vite needs a rebuild when `VITE_*` change).

The backend uses **`uv`** on Vercel; [`backend/pyproject.toml`](../backend/pyproject.toml) has `[project]` and [`backend/uv.lock`](../backend/uv.lock) is committed. From the repo root: `npx vercel login` if needed, then `npx vercel deploy --prod`.

**Fallback — frontend only** (API on Render, Railway, etc.)

- **Root Directory:** `frontend`.
- Set all `VITE_*` variables and **`VITE_API_BASE_URL`** to your API origin (no trailing slash).

## 5. Local dev — split env files (optional)

From the repo root in PowerShell:

```powershell
.\scripts\sync-kernellab-env.ps1
```

This writes `frontend/.env` and `backend/.env` from `kernellab.env` so `make run` / `make run-frontend` pick them up.

## 6. Smoke test

1. Open the deployed site, sign in, load the ops list (`/api/ops`).
2. Run a small pipeline on an image.
3. Optional: in Supabase **Table Editor**, confirm rows in `usage_logs` when logged in.

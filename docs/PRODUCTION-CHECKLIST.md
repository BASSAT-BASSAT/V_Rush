# Production checklist

Do these once before (or right after) your first deploy. Dashboard steps need **your** Supabase and Vercel logins—only you can complete them.

## 1. Supabase — database and auth

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. **SQL Editor** → New query → paste the full contents of  
   [`supabase/migrations/20260415120000_kernellab_auth.sql`](../supabase/migrations/20260415120000_kernellab_auth.sql) → **Run**.
3. **Authentication → Providers:** ensure **Email** is enabled if you use email/password sign-in.
4. **Authentication → URL configuration:**
   - **Site URL:** your production site, e.g. `https://YOUR_PROJECT.vercel.app` (or your custom domain).
   - **Redirect URLs:** add the same URL(s), and optionally `http://localhost:5173` for local dev.

## 2. Environment file (`kernellab.env`)

1. Fill [`kernellab.env`](../kernellab.env) (or copy from [`kernellab.env.example`](../kernellab.env.example)) with values from **Supabase → Project Settings → API** (URL, anon key, JWT secret).
2. **`CORS_ORIGINS`:** keep localhost entries for dev. After you know your live URL, **append** a comma and your production origin, e.g.  
   `http://localhost:5173,http://127.0.0.1:5173,https://YOUR_PROJECT.vercel.app`  
   (no spaces after commas; no path after the host.)

## 3. Vercel

**Option A — Frontend only** (API on Render, etc.)

- **Root Directory:** `frontend`.
- Import env from `kernellab.env` or set manually: all `VITE_*` variables.
- Set **`VITE_API_BASE_URL`** to your API origin (no trailing slash).

**Option B — Vercel Services** (repo root [`vercel.json`](../vercel.json))

- **Root Directory:** `.` (repository root).
- **Framework:** Services.
- **Frontend** service: `VITE_*` only (often `VITE_API_BASE_URL` empty).
- **Backend** service: `SUPABASE_JWT_SECRET`, `CORS_ORIGINS`, `KERNELLAB_AUTH_DISABLED`, `MAX_*`.

Redeploy after changing environment variables.

The backend uses **`uv`** on Vercel; `backend/pyproject.toml` must include a `[project]` table (and `backend/uv.lock` is committed for reproducible installs). If the CLI deploy fails with an invalid token, run `npx vercel login` once, then `npx vercel deploy --prod` from the repo root.

## 4. Local dev — split env files (optional)

From the repo root in PowerShell:

```powershell
.\scripts\sync-kernellab-env.ps1
```

This writes `frontend/.env` and `backend/.env` from `kernellab.env` so `make run` / `make run-frontend` pick them up.

## 5. Smoke test

1. Open the deployed site, sign in, load the ops list (`/api/ops`).
2. Run a small pipeline on an image.
3. Optional: in Supabase **Table Editor**, confirm rows in `usage_logs` when logged in.

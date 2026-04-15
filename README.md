# KernelLab

Classical computer vision playground: stack OpenCV-style operations, run a pipeline on an image, and compare before/after.

**Author:** Mohamed ElBassat

## Features

- **Auth (Supabase):** Email + password sign-in; JWT verified on the Python API for `/api/ops` and `/api/process`.
- **Database (Supabase Postgres):** `profiles` (synced from signups), `email_subscribers` (footer newsletter), `usage_logs` (one row per successful pipeline run when logged in).
- **Deploy:** Frontend on **Vercel** (or similar); API on **Render / Railway / Fly.io** via [`Dockerfile.backend`](Dockerfile.backend); optional **single-container** UI+API via root [`Dockerfile`](Dockerfile).

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL:** In the SQL Editor, run the migration in [`supabase/migrations/20260415120000_kernellab_auth.sql`](supabase/migrations/20260415120000_kernellab_auth.sql) (tables, RLS, profile trigger).
3. **API keys (Project Settings → API):**
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   - **JWT Secret** → `SUPABASE_JWT_SECRET` on the backend (used to verify `Authorization: Bearer` tokens).

Enable **Email** auth under Authentication → Providers if it is not already on.

## 2. Backend (API host)

Use [`Dockerfile.backend`](Dockerfile.backend) or run uvicorn locally.

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_JWT_SECRET` | Yes (production) | Same as Supabase **JWT Secret** (HS256). |
| `CORS_ORIGINS` | Yes (split deploy) | Comma-separated origins, e.g. `https://your-app.vercel.app` (no trailing slash on each). |
| `PORT` | Usually auto | Listen port (default `8000`). |
| `KERNELLAB_AUTH_DISABLED` | Dev only | Set to `1` to allow API calls **without** a Bearer token (local testing without Supabase). **Never** in public production. |
| `MAX_IMAGE_BYTES` | Optional | Default 8 MiB. |
| `MAX_IMAGE_DIMENSION` | Optional | Default 4096 px. |

Example (Render / Railway): connect the repo, Dockerfile path `Dockerfile.backend`, set the env vars above.

## 3. Frontend (Vercel)

1. Import the Git repo in Vercel.
2. Set **Root Directory** to `frontend`.
3. **Build:** `npm run build` (default). **Output:** `dist`.
4. **Environment variables** (Production):

| Variable | Example |
|----------|---------|
| `VITE_API_BASE_URL` | `https://your-api.onrender.com` (no trailing slash) |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (anon key) |

5. Redeploy after changing env vars.

Copy [`frontend/.env.example`](frontend/.env.example) as a checklist. For one combined list (e.g. Vercel import), use [`kernellab.env.example`](kernellab.env.example) at the repo root—copy to `kernellab.env`, fill in, and keep that file out of git.

### Vercel Services (frontend + FastAPI in one project)

Use [`vercel.json`](vercel.json) at the **repository root** and set the Vercel project **Framework** to **Services** (not “Vite” only). Use **Root Directory** **`.`** (entire repo), not `frontend`.

- The API is mounted at **`/api`**, matching existing routes (`/api/ops`, …). Set **`VITE_API_BASE_URL` empty** so the browser uses same-origin `/api/...`.
- Configure **`SUPABASE_JWT_SECRET`**, **`CORS_ORIGINS`** (your `https://…vercel.app`), and optional limits on the **backend** service environment in Vercel.
- Health for the API behind `/api`: **`GET /api/health`** (see [`backend/app/api/routes.py`](backend/app/api/routes.py)).

The UI example `/_/backend` would require a different `routePrefix` **and** matching path prefixes in FastAPI; this repo uses **`/api`** for Services instead.

**OpenCV** may exceed Vercel Python limits. If the backend build fails, keep deploying the API with [`Dockerfile.backend`](Dockerfile.backend) on Render (or similar) and use [Frontend (Vercel)](#3-frontend-vercel) with **Root Directory** `frontend` and `VITE_API_BASE_URL` pointing at that host.

## 4. Local development

```bash
make install
```

**Option A — Full stack with auth**

- Backend: create `backend/.env` from [`backend/.env.example`](backend/.env.example) with `SUPABASE_JWT_SECRET` and `CORS_ORIGINS` including `http://localhost:5173`.
- Frontend: `frontend/.env` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_BASE_URL=` (empty → same-origin) **or** leave API URL empty and use proxy:

```bash
make run              # API :8000
make run-frontend     # Vite :5173, proxies /api → :8000
```

**Option B — No Supabase (quick UI test)**

- Do **not** set `VITE_SUPABASE_URL` in `frontend/.env` (or leave it empty). The UI skips login.
- Run the API with `KERNELLAB_AUTH_DISABLED=1` (see [`backend/.env.example`](backend/.env.example)).

API routes: `GET /health`, `GET /api/ops`, `POST /api/process` (multipart: `file`, `pipeline` JSON). Authenticated requests must send `Authorization: Bearer <access_token>`.

## 5. Single-container deploy (one URL)

Same origin for UI + API (no CORS friction):

```bash
docker build -t kernellab .
docker run --rm -p 8000:8000 -e PORT=8000 -e SUPABASE_JWT_SECRET=... kernellab
```

Root [`Dockerfile`](Dockerfile) bakes the Vite build into `/app/static` and sets `STATIC_ROOT`. For auth in production, still set `SUPABASE_JWT_SECRET` in the container env.

## Smoke test

1. `GET /health` → 200.
2. Sign in on the deployed site; `/api/ops` returns 200 with Bearer token.
3. Run a pipeline on an image; check `usage_logs` in Supabase (if migration applied).

## Tests

Backend tests disable API auth via `KERNELLAB_AUTH_DISABLED` in [`backend/tests/conftest.py`](backend/tests/conftest.py).

```bash
make test
make lint
```

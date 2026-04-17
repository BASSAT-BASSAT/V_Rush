# V-Rush

Classical computer vision playground: stack OpenCV-style operations, run a pipeline on an image, and compare before/after.

**Co-Founders:** Mohamed Elbassat and Rokayya Aly

## Features

- **Auth (Supabase):** Email + password sign-in; JWT verified on the Python API for `/api/ops` and `/api/process`.
- **Database (Supabase Postgres):** `profiles` (synced from signups), `email_subscribers` (footer newsletter), `usage_logs` (one row per successful pipeline run when logged in).
- **Deploy (recommended):** **All on Vercel** — one project with **Services** ([`vercel.json`](vercel.json)): Vite frontend at `/` and FastAPI at `/api` on the same domain. **Fallback:** API on **Render / Railway / Fly** via [`Dockerfile.backend`](Dockerfile.backend), frontend-only Vercel with `VITE_API_BASE_URL`; optional **single-container** via root [`Dockerfile`](Dockerfile).

For a step-by-step go-live list (SQL, Auth URLs, Vercel, CORS), see [`docs/PRODUCTION-CHECKLIST.md`](docs/PRODUCTION-CHECKLIST.md). To regenerate `frontend/.env` and `backend/.env` from `kernellab.env`, run `.\scripts\sync-kernellab-env.ps1` from the repo root.

### CV-only deploy (no Supabase, no database)

You can ship **only the OpenCV playground**: no login, no Postgres, no JWT setup.

1. **Frontend (Vercel):** Delete or leave empty **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`**. Leave **`VITE_API_BASE_URL`** empty if the API is on the same deployment (Services) or set it to your API URL.
2. **Backend:** Set **`KERNELLAB_AUTH_DISABLED=1`** so `/api/ops` and `/api/process` work **without** a Bearer token. You can omit **`SUPABASE_JWT_SECRET`**. Set **`CORS_ORIGINS`** to your site origin (e.g. `https://your-app.vercel.app`).
3. **Redeploy** the frontend (so Vite omits Supabase) and the backend.

The UI skips sign-in and the footer newsletter when Supabase is unset. **Anyone** can call your API while `KERNELLAB_AUTH_DISABLED=1`—use only for private demos or lock the deployment down.

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL:** In the SQL Editor, run the migration in [`supabase/migrations/20260415120000_kernellab_auth.sql`](supabase/migrations/20260415120000_kernellab_auth.sql) (tables, RLS, profile trigger).
3. **API keys (Project Settings → API):**
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   - **JWT Secret** → `SUPABASE_JWT_SECRET` on the backend (used to verify `Authorization: Bearer` tokens).

Enable **Email** auth under Authentication → Providers if it is not already on.

## 2. Deploy — all on Vercel (recommended)

This is the **default** setup: **one Vercel project**, **no separate API host**. The repo root [`vercel.json`](vercel.json) defines two **Services**: Vite (`frontend/`) at `/` and FastAPI (`backend/app/main.py`) at `/api`.

1. In [Vercel](https://vercel.com), **Import** this Git repository.
2. **Root Directory:** **`.`** (repository root). Do **not** set it to `frontend` for this mode.
3. **Framework preset:** **Services** (Vercel detects `experimentalServices` in `vercel.json`).
4. **Environment variables** (Production — set on the right **service** where the dashboard allows, or as shared project vars as documented in Vercel):

   | Where | Variable | Value |
   |--------|----------|--------|
   | Frontend build | `VITE_API_BASE_URL` | **Empty** — same-origin calls to `/api/...` |
   | Frontend build | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | From Supabase (§1) |
   | Backend (Python) | `SUPABASE_JWT_SECRET` | Supabase JWT secret (§1) |
   | Backend (Python) | `CORS_ORIGINS` | Your site origin(s), e.g. `https://YOUR_PROJECT.vercel.app` (comma-separated, no spaces) |
   | Optional | `KERNELLAB_AUTH_DISABLED`, `MAX_*` | See table below |

5. **Redeploy** after changing env vars (Vite bakes `VITE_*` at build time).

**Health check:** `GET /api/health` should return JSON with `"status":"ok"`.

Dependencies for the Python service come from [`backend/pyproject.toml`](backend/pyproject.toml) (Vercel uses **uv**; [`backend/uv.lock`](backend/uv.lock) is committed for reproducible installs). See [`docs/PRODUCTION-CHECKLIST.md`](docs/PRODUCTION-CHECKLIST.md) for CLI deploy notes.

**If the Python service fails to build** (bundle size, native wheels, or memory): fall back to [split deploy](#3-split-deploy-vercel--external-api) below.

### Backend environment reference (Vercel or any host)

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_JWT_SECRET` | Yes (production with auth) | Same as Supabase **JWT Secret** (HS256). |
| `CORS_ORIGINS` | Yes | Comma-separated origins, e.g. `https://your-app.vercel.app` (no trailing slash on each). |
| `PORT` | Usually auto | Listen port (default `8000`). |
| `KERNELLAB_AUTH_DISABLED` | CV-only / dev | Set to `1` to allow `/api/*` **without** a Bearer token. |
| `MAX_IMAGE_BYTES` | Optional | Default 8 MiB. |
| `MAX_IMAGE_DIMENSION` | Optional | Default 4096 px. |

**Object detection (YOLO26):** `yolo26_detect` uses **Ultralytics** and **PyTorch** — large bundle and RAM. On Vercel, ensure the backend service has enough **memory** in `vercel.json` (already set to 3008 MB); if deploys fail, use Docker + a dedicated host (below). Ultralytics is **AGPL-3.0** — confirm licensing. For Docker images, you can bake `yolo26n.pt` into the image (see [`Dockerfile.backend`](Dockerfile.backend)).

Copy [`frontend/.env.example`](frontend/.env.example) or [`kernellab.env.example`](kernellab.env.example) as a checklist. Run `.\scripts\sync-kernellab-env.ps1` locally to split env into `frontend/.env` and `backend/.env`.

## 3. Split deploy (Vercel + external API)

Use this if you **only** deploy the static app on Vercel or the full-stack Vercel build fails.

1. **Frontend project:** Root Directory **`frontend`**, Framework **Vite**, build `npm run build`, output `dist`.
2. Set **`VITE_API_BASE_URL`** to your API origin (no trailing slash), e.g. `https://your-api.onrender.com`.
3. **API:** Deploy [`Dockerfile.backend`](Dockerfile.backend) on Render / Railway / Fly.io and set the same backend env vars as in the table above.

Same Supabase and CORS rules apply; **`CORS_ORIGINS`** on the API must include your Vercel URL.

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

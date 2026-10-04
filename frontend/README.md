# V-Rush frontend

This directory contains the V-Rush web application, built with React, TypeScript,
Vite, and Motion.

From the repository root:

```bash
make install-frontend
make run-frontend
```

The development server runs at <http://localhost:5173>. Copy
[`frontend/.env.example`](.env.example) to `.env` for local configuration. The
frontend can run against the local FastAPI service or an externally deployed API by
setting `VITE_API_BASE_URL`.

For the project description, backend setup, deployment, and citation instructions,
see the root [`README.md`](../README.md).

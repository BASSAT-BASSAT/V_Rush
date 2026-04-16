# KernelLab — run from repo root. On Windows, use Git Bash or `make` from GnuWin32 / Chocolatey.
#
# Dev: terminal A → `make run`        (API only, http://127.0.0.1:8000 — GET / returns 404; use /api/ops, /health, etc.)
#      terminal B → `make run-frontend` (Vite UI, http://127.0.0.1:5173)
# `make run front-end` does NOT start the UI — extra words are ignored; use the hyphenated target below.

.PHONY: install install-backend install-frontend test lint format run run-frontend frontend clean

PYTHON ?= python
NPM ?= npm

install: install-backend install-frontend

install-backend:
	$(PYTHON) -m pip install -r backend/requirements-dev.txt

install-frontend:
	cd frontend && $(NPM) install

test:
	cd backend && $(PYTHON) -m pytest

lint:
	cd backend && $(PYTHON) -m ruff check app tests

format:
	cd backend && $(PYTHON) -m ruff format app tests

run:
	cd backend && $(PYTHON) -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

run-frontend:
	cd frontend && $(NPM) run dev

# Alias so `make frontend` works (same as run-frontend)
frontend: run-frontend

clean:
	cd backend && $(PYTHON) -c "import pathlib, shutil; r=pathlib.Path('.'); [shutil.rmtree(p, ignore_errors=True) for p in r.rglob('__pycache__')]; shutil.rmtree(r/'.pytest_cache', ignore_errors=True)"

# KernelLab — single image: Vite frontend + FastAPI (OpenCV)
# Build: docker build -t kernellab .
# Run:  docker run -p 8000:8000 -e PORT=8000 kernellab

# --- Frontend (Vite) ---
FROM node:20-bookworm-slim AS frontend
WORKDIR /src/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# Same-origin API: leave VITE_API_BASE_URL unset
RUN npm run build

# --- Backend ---
FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    STATIC_ROOT=/app/static

# OpenCV headless wheels often need glib; add more libs if import fails at runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/yolo26n.onnx ./yolo26n.onnx
# MobileSAM ONNX weights are optional; copy if present (COPY [] form doesn't glob).
# Export them locally (see README) then uncomment the next two lines:
# COPY backend/mobile_sam_encoder.onnx ./mobile_sam_encoder.onnx
# COPY backend/mobile_sam_decoder.onnx ./mobile_sam_decoder.onnx
COPY backend/app ./app

COPY --from=frontend /src/frontend/dist ./static

EXPOSE 8000

# Hosts (Railway, Render, Fly) set PORT
CMD ["sh", "-c", "exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

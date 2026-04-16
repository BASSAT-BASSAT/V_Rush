"""Supabase JWT verification for protected API routes."""

from __future__ import annotations

import os

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError

security = HTTPBearer(auto_error=False)


def auth_disabled() -> bool:
    # Vercel/dashboard values may include trailing newlines — strip before compare.
    v = os.getenv("KERNELLAB_AUTH_DISABLED", "").strip().lower()
    return v in ("1", "true", "yes")


def jwt_secret() -> str | None:
    s = os.getenv("SUPABASE_JWT_SECRET", "").strip()
    return s or None


async def require_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    """Return authenticated user id (Supabase `sub`) or raise 401."""
    if auth_disabled():
        return os.getenv("KERNELLAB_TEST_USER_ID", "anonymous")

    secret = jwt_secret()
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="Server is not configured for authentication (missing SUPABASE_JWT_SECRET)",
        )

    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except InvalidTokenError:
        # Same Supabase HS256 token; some tokens omit or vary `aud` — still verify signature + `sub`.
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"verify_signature": True, "verify_aud": False},
            )
        except InvalidTokenError as e:
            raise HTTPException(
                status_code=401,
                detail=(
                    "Invalid or expired token. If you use login: set API SUPABASE_JWT_SECRET to the "
                    "same value as Supabase Project Settings → API → JWT Secret (Legacy JWT Secret). "
                    "For CV-only / no-login mode: set KERNELLAB_AUTH_DISABLED=1 on the API and redeploy."
                ),
            ) from e

    sub = payload.get("sub")
    if not sub or not isinstance(sub, str):
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return sub

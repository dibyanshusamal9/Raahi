"""Officer sign-in sessions for the officer dashboard.

Signing in with the officer access code (OFFICER_ACCESS_CODE in .env) gives a
session token: the officer's name and an expiry, signed with a key derived
from the access code, so changing the code signs everyone out. The dashboard
keeps the token in an httpOnly cookie. It reaches us either in that cookie
(the browser's requests come through the dashboard's /voice-api proxy) or as a
Bearer token (the dashboard's own server-side requests).
"""
from __future__ import annotations
import base64, hashlib, hmac, json, time
from fastapi import HTTPException, Request
from ..settings import settings

COOKIE = "raahi_session"
SESSION_SECONDS = 12 * 60 * 60


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _code() -> bytes:
    code = (settings.officer_access_code or "").strip()
    if not code:
        raise HTTPException(503, "Officer sign-in is switched off: add OFFICER_ACCESS_CODE to the backend .env.")
    return code.encode()


def _sign(payload: str) -> str:
    key = hashlib.sha256(b"raahi-officer-session:" + _code()).digest()
    return _b64(hmac.new(key, payload.encode(), hashlib.sha256).digest())


def code_matches(code: str) -> bool:
    # Compared as bytes: compare_digest refuses non-ASCII str.
    return hmac.compare_digest(code.strip().encode(), _code())


def issue(name: str) -> str:
    claims = {"name": name, "exp": int(time.time()) + SESSION_SECONDS}
    payload = _b64(json.dumps(claims, ensure_ascii=False).encode())
    return f"{payload}.{_sign(payload)}"


def verify(token: str | None) -> str | None:
    """The officer's name if the token is genuine and unexpired."""
    if not token or "." not in token:
        return None
    payload, signature = token.rsplit(".", 1)
    if not hmac.compare_digest(signature.encode(), _sign(payload).encode()):
        return None
    try:
        claims = json.loads(_unb64(payload))
    except ValueError:
        return None
    if not isinstance(claims, dict) or claims.get("exp", 0) < time.time():
        return None
    name = claims.get("name")
    return name if isinstance(name, str) and name else None


def require_officer(request: Request) -> str:
    """FastAPI dependency: the signed-in officer's name, else 401."""
    auth = request.headers.get("authorization", "")
    token = auth[7:].strip() if auth.lower().startswith("bearer ") else request.cookies.get(COOKIE)
    name = verify(token)
    if not name:
        raise HTTPException(401, "Please sign in again.")
    return name

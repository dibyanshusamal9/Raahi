"""Runtime localisation.

Every user-facing line is authored ONCE in English and translated to the
caller's language at send time via Sarvam's `sarvam-translate:v1` model, which
covers all 22 scheduled Indian languages. Results are cached (in memory + on
disk) so each unique (text, language) pair is translated only once — after the
first interview in a language, every question is instant.

Why translate instead of hand-authoring dicts: the old approach kept a
translation dict per question and silently fell back to English for any
language not in the dict. That is exactly the "it asked in English in the
middle of a Marathi interview" bug. Translating at send time means a language
either works everywhere or nowhere — never half.

Pre-seeded high-quality human translations for the core languages
(hi/bn/ta/mr) are loaded into the cache so those stay instant and idiomatic;
everything else goes through Sarvam.
"""
from __future__ import annotations
import json
import os
import tempfile
import threading

import httpx

from ..settings import settings
from ..logging import log

# 2-letter UI code -> Sarvam BCP-47-ish code.
LANG_TO_SARVAM = {"bn": "bn-IN", "en": "en-IN", "gu": "gu-IN", "hi": "hi-IN", "kn": "kn-IN",
                "ml": "ml-IN", "mr": "mr-IN", "or": "od-IN", "od": "od-IN", "pa": "pa-IN",
                "ta": "ta-IN", "te": "te-IN"}

_CACHE_PATH = os.path.join(tempfile.gettempdir(), "raahi-i18n-cache.json")
_lock = threading.Lock()
_cache: dict[str, str] = {}


def _load_cache() -> None:
    global _cache
    try:
        with open(_CACHE_PATH, "r", encoding="utf-8") as f:
            _cache = json.load(f)
    except Exception:
        _cache = {}


def _save_cache() -> None:
    try:
        with open(_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(_cache, f, ensure_ascii=False)
    except Exception:
        pass


def _key(text: str, lang: str) -> str:
    return f"{lang} {text}"


_load_cache()


def seed(translations: dict[str, dict[str, str]]) -> None:
    """Pre-load human translations. Shape: {english_text: {lang: translated}}."""
    changed = False
    for en_text, by_lang in translations.items():
        for lang, translated in by_lang.items():
            k = _key(en_text, lang)
            if _cache.get(k) != translated:
                _cache[k] = translated
                changed = True
    if changed:
        _save_cache()


async def localize(text: str, lang: str) -> str:
    """Return `text` in `lang`. English (or unknown code) returns as-is.
    Never raises — on any failure returns the English source, which is the
    safest possible fallback."""
    if not text:
        return text
    lang = (lang or "en").lower()
    if lang in ("en", "en-in"):
        return text

    k = _key(text, lang)
    cached = _cache.get(k)
    if cached is not None:
        return cached

    tgt = LANG_TO_SARVAM.get(lang)
    if not tgt or not settings.sarvam_api_key:
        return text

    try:
        async with httpx.AsyncClient(timeout=20.0) as c:
            r = await c.post(
                "https://api.sarvam.ai/translate",
                headers={"api-subscription-key": settings.sarvam_api_key},
                json={
                    "input": text,
                    "source_language_code": "en-IN",
                    "target_language_code": tgt,
                    "model": "sarvam-translate:v1",
                },
            )
            r.raise_for_status()
            out = (r.json().get("translated_text") or "").strip()
    except Exception as e:
        log.warning("i18n.translate_failed", lang=lang, err=str(e)[:120])
        return text

    if not out:
        return text
    with _lock:
        _cache[k] = out
        _save_cache()
    return out


# The deterministic extractor only understands answers in en/hi/bn/ta/mr. For
# the other scheduled languages, translate the caller's ANSWER to English first
# so the same rules (and the English keyword tables) apply. hi/bn/ta/mr are
# left in their own script because the extractor already has native keywords
# for them and translation would only add latency + risk.
RULE_NATIVE_LANGS = {"en", "hi", "bn", "ta", "mr"}


async def to_english(text: str, lang: str) -> str:
    """Translate a caller's answer INTO English. Returns the original text for
    English / rule-native languages, and on any failure (safe fallback)."""
    if not text:
        return text
    lang = (lang or "en").lower()
    if lang in RULE_NATIVE_LANGS or lang == "en-in":
        return text

    src = LANG_TO_SARVAM.get(lang)
    if not src or not settings.sarvam_api_key:
        return text

    k = _key("→en " + text, lang)   # separate cache namespace from localize()
    cached = _cache.get(k)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=20.0) as c:
            r = await c.post(
                "https://api.sarvam.ai/translate",
                headers={"api-subscription-key": settings.sarvam_api_key},
                json={
                    "input": text,
                    "source_language_code": src,
                    "target_language_code": "en-IN",
                    "model": "sarvam-translate:v1",
                },
            )
            r.raise_for_status()
            out = (r.json().get("translated_text") or "").strip()
    except Exception as e:
        log.warning("i18n.to_english_failed", lang=lang, err=str(e)[:120])
        return text

    if not out:
        return text
    with _lock:
        _cache[k] = out
        _save_cache()
    return out

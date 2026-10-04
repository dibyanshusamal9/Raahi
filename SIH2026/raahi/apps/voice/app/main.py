from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .logging import configure_logging, log
from .routers import session, ivr, whatsapp, admin, voice, simulator, officer
from .settings import settings
import os

configure_logging()
app = FastAPI(title="RAAHI Voice", version="0.1.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)

app.include_router(session.router)
app.include_router(simulator.router)
app.include_router(ivr.router)
app.include_router(whatsapp.router)
app.include_router(admin.router)
app.include_router(voice.router)
app.include_router(officer.router)

TTS_DIR = "/tmp/raahi-tts"
os.makedirs(TTS_DIR, exist_ok=True)
app.mount("/tts", StaticFiles(directory=TTS_DIR), name="tts")


@app.get("/health")
async def health():
    return {"ok": True, "env": settings.app_env}


@app.on_event("startup")
async def on_start():
    # Pre-load the human translations for the core languages so hi/bn/ta/mr
    # questions are instant and idiomatic; everything else translates on first
    # use via Sarvam and is then cached.
    from .services.i18n import seed
    from .services.next_question import SEED
    from .routers.session import reask_seed
    seed(SEED)
    seed(reask_seed())
    log.info("voice.start", provider_ivr=settings.ivr_provider,
             provider_wa=settings.whatsapp_provider,
             extractor=settings.extractor_provider)

# Voice service

FastAPI application implementing FR-01 through FR-10 (except FR-09 which
lives in the web app).

## Endpoints

    POST /session/turn              transport-agnostic core turn
    POST /ivr/inbound               IVR webhook: call started
    POST /ivr/turn                  IVR webhook: STT chunk / DTMF digit
    POST /whatsapp/webhook          WhatsApp voice note in
    POST /admin/recommend/{bid}     debug: run ranker directly
    GET  /admin/explain/{rec_id}    explainability trail (FR-10)
    GET  /health

## Run

    pip install -r requirements.txt
    uvicorn app.main:app --reload

## Environment

See `.env.example` at repo root. In dev, all provider keys are optional;
mock adapters return deterministic responses.

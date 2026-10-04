from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]
ENV_FILE = ROOT_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(ENV_FILE), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # App
    app_env: str = "dev"
    log_level: str = "INFO"
    interview_max_turns: int = 8
    interview_stable_turns: int = 2

    # Supabase / DB
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_anon_key: str | None = None
    database_url: str | None = None

    # Sarvam
    sarvam_api_key: str | None = None
    sarvam_stt_model: str = "saaras:v2"
    sarvam_tts_model: str = "bulbul:v1"
    sarvam_llm_model: str = "sarvam-m"
    # A warm, soft female voice. bulbul:v3 female speakers: priya, neha,
    # pooja, simran, kavya, ishita, shreya, roopa, ritu. (anushka/vidya/
    # manisha are bulbul:v2 names — v3 rejects them with HTTP 400.)
    # `pace` < 1.0 slows delivery slightly for a gentler tone.
    sarvam_tts_speaker: str = "priya"
    sarvam_tts_pace: float = 1.25         # 0.5-2.0; 1.0 sounded too slow on calls
    sarvam_tts_pitch: float = 0.0         # bulbul v1/v2 only
    sarvam_tts_temperature: float = 0.6   # bulbul v3 expressiveness (0.01-2.0)
    sarvam_tts_pause_s: float = 0.2       # silence between sentences
    # Officer site: the access code officers enter to add or change job
    # openings. Unset = officer editing is switched off.
    officer_access_code: str | None = None

    # Extractor LLM
    extractor_provider: str = "mock"  # mock | anthropic | openai | sarvam | grok | groq | gemini
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    grok_api_key: str | None = None
    xai_api_key: str | None = None
    grok_model: str = "grok-2-latest"
    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.0-flash"

    # IVR / WhatsApp / SMS
    ivr_provider: str = "mock"  # mock | twilio | exotel
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_phone_number: str | None = None
    exotel_sid: str | None = None
    exotel_token: str | None = None
    exotel_virtual_number: str | None = None

    whatsapp_provider: str = "mock"
    meta_waba_phone_id: str | None = None
    meta_waba_token: str | None = None

    sms_provider: str = "mock"


settings = Settings()

"""Provider adapters. All adapters share a small interface so swapping
Sarvam↔Whisper or Exotel↔Twilio never touches routing or business logic."""

from .ivr_base import IVRProvider
from .whatsapp_base import WhatsAppProvider
from .ivr_mock import MockIVR
from .ivr_exotel import ExotelIVR
from .ivr_twilio import TwilioIVR
from .whatsapp_mock import MockWhatsApp
from .whatsapp_meta import MetaWhatsApp
from ..settings import settings


def get_ivr() -> IVRProvider:
    if settings.ivr_provider == "exotel":
        return ExotelIVR()
    if settings.ivr_provider == "twilio":
        return TwilioIVR()
    return MockIVR()


def get_whatsapp() -> WhatsAppProvider:
    if settings.whatsapp_provider == "meta":
        return MetaWhatsApp()
    return MockWhatsApp()

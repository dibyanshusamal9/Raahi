"""Lightweight Indic-script -> Latin transliteration, dependency-free.

Callers speak their district in their own language, so Sarvam STT hands us the
name in native script (Devanagari for Hindi/Marathi, Bengali, Tamil). The
`indian_districts` reference table stores Latin names only, so a direct match
rejects every native-script district. This module romanises the four pilot
scripts to a rough phonetic Latin that a fuzzy match can line up against the
Latin district names — e.g. "पटना" -> "patanaa" (fuzzy-matches "Patna").

It is deliberately approximate: the goal is a comparison key, not a scholarly
IAST transliteration. Inherent vowel is treated as 'a' for every script, which
is close enough once the caller-side fuzzy match tolerates schwa deletion.
"""
from __future__ import annotations

import unicodedata

# Consonants (base sound, without the inherent vowel) across Devanagari,
# Bengali and Tamil. The inherent 'a' is appended by the algorithm below.
_CONS = {
    # Devanagari
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
    "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
    "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
    "य": "y", "र": "r", "ल": "l", "व": "v", "ळ": "l",
    "श": "sh", "ष": "sh", "स": "s", "ह": "h",
    # Bengali
    "ক": "k", "খ": "kh", "গ": "g", "ঘ": "gh", "ঙ": "ng",
    "চ": "ch", "ছ": "chh", "জ": "j", "ঝ": "jh", "ঞ": "ny",
    "ট": "t", "ঠ": "th", "ড": "d", "ঢ": "dh", "ণ": "n",
    "ত": "t", "থ": "th", "দ": "d", "ধ": "dh", "ন": "n",
    "প": "p", "ফ": "ph", "ব": "b", "ভ": "bh", "ম": "m",
    "য": "j", "র": "r", "ল": "l", "শ": "sh", "ষ": "sh",
    "স": "s", "হ": "h", "ৎ": "t",
    # Tamil
    "க": "k", "ங": "ng", "ச": "ch", "ஞ": "ny", "ட": "t",
    "ண": "n", "த": "th", "ந": "n", "ன": "n", "ப": "p",
    "ம": "m", "ய": "y", "ர": "r", "ற": "r", "ல": "l",
    "ள": "l", "ழ": "zh", "வ": "v", "ஶ": "sh", "ஷ": "sh",
    "ஸ": "s", "ஹ": "h", "ஜ": "j",
}

# Independent vowels.
_INDEP = {
    "अ": "a", "आ": "aa", "इ": "i", "ई": "ii", "उ": "u", "ऊ": "uu",
    "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ऑ": "o", "ऍ": "e",
    "অ": "a", "আ": "aa", "ই": "i", "ঈ": "ii", "উ": "u", "ঊ": "uu",
    "ঋ": "ri", "এ": "e", "ঐ": "ai", "ও": "o", "ঔ": "au",
    "அ": "a", "ஆ": "aa", "இ": "i", "ஈ": "ii", "உ": "u", "ஊ": "uu",
    "எ": "e", "ஏ": "ee", "ஐ": "ai", "ஒ": "o", "ஓ": "oo", "ஔ": "au",
}

# Dependent vowel signs (matras) — replace the inherent vowel of the
# preceding consonant.
_MATRA = {
    "ा": "aa", "ि": "i", "ी": "ii", "ु": "u", "ू": "uu", "ृ": "ri",
    "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o", "ॅ": "e",
    "া": "aa", "ি": "i", "ী": "ii", "ু": "u", "ূ": "uu", "ৃ": "ri",
    "ে": "e", "ৈ": "ai", "ো": "o", "ৌ": "au",
    "ா": "aa", "ி": "i", "ீ": "ii", "ு": "u", "ூ": "uu",
    "ெ": "e", "ே": "ee", "ை": "ai", "ொ": "o", "ோ": "oo", "ௌ": "au",
}

# Virama / halant / pulli — suppresses the inherent vowel.
_VIRAMA = {"्", "্", "்"}

# Anusvara / chandrabindu / visarga — nasal or aspirate signs.
_SIGN = {
    "ं": "n", "ँ": "n", "ः": "h",
    "ং": "ng", "ঁ": "n", "ঃ": "h",
    "ஂ": "n", "ஃ": "h",
}

# Nukta marks (Devanagari U+093C, Bengali U+09BC) and the sound they give the
# preceding consonant.
_NUKTA = {"़", "়"}
_NUKTA_SOUND = {
    "क": "k", "ख": "kh", "ग": "g", "ज": "z", "ड": "r",
    "ढ": "rh", "फ": "f", "य": "y",
    "ড": "r", "ঢ": "rh", "য": "y",
}


def to_latin(text: str) -> str:
    """Romanise an Indic-script string to a rough phonetic Latin key, applying
    Hindi-style schwa deletion so the result lines up with the usual English
    spelling. ASCII passes through unchanged; unknown code points are dropped.

    Schwa deletion (VC_CV rule): a consonant's inherent vowel is dropped when it
    sits between two vowel-bearing units, or is word-final. This turns पटना into
    'patna' (not 'patana', which would collide with Patan) while keeping the a's
    in मुज़फ़्फ़रपुर -> 'muzaffarpur'.
    """
    # NFC recomposes split vowel signs (Bengali ে + া -> ো) so _MATRA sees them
    # whole, while nukta letters stay decomposed as base + ़ (they are Unicode
    # composition exclusions) — exactly what the base+nukta handling wants.
    s = unicodedata.normalize("NFC", text or "")

    # Pass 1: tokenise. Each token is (consonant_sound, vowel) where vowel is a
    # Latin string, "" for a dead (virama) consonant, or the sentinel INHERENT.
    # Non-consonants become (None, latin) tokens.
    INHERENT = "\0"
    tokens: list[tuple[str | None, str]] = []
    i, n = 0, len(s)
    while i < n:
        c = s[i]
        if c in _CONS:
            sound = _CONS[c]
            if i + 1 < n and s[i + 1] in _NUKTA:      # ज़ -> z, फ़ -> f
                sound = _NUKTA_SOUND.get(c, sound)
                i += 1
            nxt = s[i + 1] if i + 1 < n else ""
            if nxt in _MATRA:
                tokens.append((sound, _MATRA[nxt]))
                i += 1
            elif nxt in _VIRAMA:
                tokens.append((sound, ""))            # dead consonant
                i += 1
            else:
                inh = "o" if 0x0980 <= ord(c) <= 0x09FF else "a"
                tokens.append((sound, INHERENT if inh == "a" else inh))
        elif c in _INDEP:
            tokens.append((None, _INDEP[c]))
        elif c in _MATRA:
            tokens.append((None, _MATRA[c]))
        elif c in _SIGN:
            tokens.append((None, _SIGN[c]))
        elif c in _VIRAMA:
            pass
        elif c.isascii() and c.isalpha():
            tokens.append((None, c.lower()))
        i += 1

    def carries_vowel(idx: int) -> bool:
        if not (0 <= idx < len(tokens)):
            return False
        return tokens[idx][1] != ""  # dead (virama) consonant carries none

    # index of the last consonant token (for word-final schwa deletion)
    last_cons = max((k for k, t in enumerate(tokens) if t[0] is not None),
                    default=-1)

    out: list[str] = []
    for k, (cons, vowel) in enumerate(tokens):
        if cons is not None:
            out.append(cons)
            if vowel == INHERENT:
                # Delete the schwa when word-final, or flanked by vowels.
                word_final = k == last_cons
                flanked = carries_vowel(k - 1) and carries_vowel(k + 1)
                if not (word_final or flanked):
                    out.append("a")
            else:
                out.append(vowel)
        else:
            out.append(vowel)
    return "".join(out)


def has_indic(text: str) -> bool:
    """True if the string contains any character in the supported Indic ranges
    (Devanagari U+0900-097F, Bengali U+0980-09FF, Tamil U+0B80-0BFF)."""
    for c in text or "":
        o = ord(c)
        if 0x0900 <= o <= 0x097F or 0x0980 <= o <= 0x09FF or 0x0B80 <= o <= 0x0BFF:
            return True
    return False

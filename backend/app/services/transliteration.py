"""
Transliteration (Devanagari ↔ Latin) and fuzzy name matching.
Uses RapidFuzz for scoring.

Matching bands (spec BK3):
  [95, 100] → GREEN
  [75, 95)  → AMBER (only if father matches)
  below 75 or father mismatch → RED
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from rapidfuzz import fuzz


class MatchBand(str, Enum):
    GREEN = "GREEN"
    AMBER = "AMBER"
    RED = "RED"


@dataclass
class MatchResult:
    name_score: float
    father_score: float
    verdict: str
    reason_codes: list[str] = field(default_factory=list)

    @property
    def score(self) -> float:
        return self.name_score

    @property
    def band(self) -> MatchBand:
        return MatchBand(self.verdict)

    @property
    def reasons(self) -> list[str]:
        return self.reason_codes

    def __getitem__(self, item: str) -> Any:
        return getattr(self, item)



# ── Simple transliteration tables ───────────────────────────────────
# We use a lightweight custom mapping rather than a full library
# to keep it fast and avoid heavy dependencies.

_DEVANAGARI_TO_LATIN = {
    "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo",
    "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ऋ": "ri",
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
    "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
    "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
    "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
    "ष": "sh", "स": "s", "ह": "h",
    "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo",
    "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ृ": "ri",
    "ं": "n", "ँ": "n", "ः": "h", "्": "",
    "क़": "q", "ख़": "kh", "ग़": "g", "ज़": "z", "फ़": "f",
    "ड़": "d", "ढ़": "dh",
}


def transliterate_to_latin(text: str) -> str:
    """Convert Devanagari text to approximate Latin for comparison."""
    result = []
    i = 0
    while i < len(text):
        # Try two-char sequence first (e.g., "ड़")
        if i + 1 < len(text):
            two = text[i:i+2]
            if two in _DEVANAGARI_TO_LATIN:
                result.append(_DEVANAGARI_TO_LATIN[two])
                i += 2
                continue
        char = text[i]
        if char in _DEVANAGARI_TO_LATIN:
            result.append(_DEVANAGARI_TO_LATIN[char])
        elif char.isascii():
            result.append(char.lower())
        elif char == " ":
            result.append(" ")
        # Skip other characters (virama is mapped to empty above)
        i += 1
    return "".join(result)


def normalize_name(name: str) -> str:
    """Normalize a name for comparison: transliterate if needed, lowercase, strip."""
    # Check if the name contains Devanagari
    has_devanagari = any(
        "\u0900" <= c <= "\u097F" for c in name
    )
    if has_devanagari:
        name = transliterate_to_latin(name)
    # Basic normalization
    name = name.lower().strip()
    name = re.sub(r"\s+", " ", name)
    # Remove common prefixes/suffixes
    name = re.sub(r"\bs/o\b", "", name)
    name = re.sub(r"\bd/o\b", "", name)
    name = re.sub(r"\bw/o\b", "", name)
    return name.strip()


# ── Fuzzy matching ──────────────────────────────────────────────────

def split_given_surname(name: str) -> tuple[str, str]:
    """Split normalized name into given name and surname."""
    parts = name.strip().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def match_score(name1: str, name2: str) -> float:
    """Score similarity between two names (0–100).
    Transliterates Devanagari first, then scores given name and surname separately if multi-word.
    """
    n1 = normalize_name(name1)
    n2 = normalize_name(name2)
    if not n1 or not n2:
        return 0.0
    if n1 == n2:
        return 100.0

    g1, s1 = split_given_surname(n1)
    g2, s2 = split_given_surname(n2)
    if s1 and s2:
        g_score = fuzz.ratio(g1, g2)
        s_score = fuzz.ratio(s1, s2)
        return (g_score + s_score) / 2.0

    return fuzz.token_sort_ratio(n1, n2)


def match_names(
    record_name: str | None = None,
    record_father: str | None = None,
    applicant_name: str | None = None,
    applicant_father: str | None = None,
    *,
    registry_name: str | None = None,
    registry_father: str | None = None,
    bank_name: str | None = None,
    bank_father: str | None = None,
) -> MatchResult:
    """Match applicant/bank record against registry owner record.

    Accepts both (record_name, record_father, applicant_name, applicant_father)
    and (registry_name, registry_father, bank_name, bank_father).
    """
    rec_name = registry_name or record_name or ""
    rec_father = registry_father or record_father or ""
    app_name = bank_name or applicant_name or ""
    app_father = bank_father or applicant_father or ""

    name_score = match_score(rec_name, app_name)
    father_score = match_score(rec_father, app_father)

    reason_codes = []

    # Half-open bands (Spec BK3):
    # GREEN: [95, 100] & father >= 90
    # AMBER: [75, 95) & father >= 85
    # RED: < 75 OR father < 85
    if name_score >= 95.0 and father_score >= 90.0:
        verdict = "GREEN"
    elif name_score >= 75.0 and father_score >= 85.0:
        verdict = "AMBER"
        reason_codes.append("IDENTITY_SPELLING_REVIEW: Minor spelling/transliteration divergence")
    else:
        verdict = "RED"
        if father_score < 85.0:
            reason_codes.append("IDENTITY_FATHER_MISMATCH: Father name mismatch with registry")
        if name_score < 75.0:
            reason_codes.append("IDENTITY_NAME_MISMATCH: Applicant name mismatch with registry")

    return MatchResult(
        name_score=round(name_score, 2),
        father_score=round(father_score, 2),
        verdict=verdict,
        reason_codes=reason_codes,
    )



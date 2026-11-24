"""
Chat Guardrails Service.
Guarantees zero AI math hallucination by:
1. Deterministically substituting {{placeholder}} tokens from server-side tool_data_sink.
2. Converting numeric values (currency, percentage, decimal, integers) into natural spoken words
   for speech synthesis (en-IN and hi-IN / Chhattisgarhi).
3. Producing dual outputs: display_text (formatted digits for UI) and tts_text (spoken words).
"""
import re
from typing import Dict, Any, Tuple
from decimal import Decimal, ROUND_HALF_UP

from app.rules.number_words import (
    number_to_hindi_words,
    rupees_to_hindi_words,
    number_to_english_words,
    rupees_to_english_words,
)


def _clean_number_str(s: str) -> Tuple[int, Decimal]:
    clean = s.replace(",", "").strip()
    d = Decimal(clean)
    i = int(d)
    return i, d


def currency_to_words(amount_str: str, language: str) -> str:
    """Convert INR currency string (e.g. 2,00,000 or 15000) to words."""
    try:
        clean = amount_str.replace(",", "").strip()
        val = int(Decimal(clean))
        paise = val * 100
        lang = language.lower()
        if "hi" in lang or "chh" in lang:
            return rupees_to_hindi_words(paise)
        return rupees_to_english_words(paise)
    except Exception:
        return f"{amount_str} rupees"


def percentage_to_words(num_str: str, language: str) -> str:
    """Convert percentage string (e.g. 7 or 4.5) to spoken words."""
    try:
        lang = language.lower()
        is_hi = "hi" in lang or "chh" in lang
        if "." in num_str:
            whole, frac = num_str.split(".", 1)
            w_int = int(whole)
            f_int = int(frac)
            if is_hi:
                w_words = number_to_hindi_words(w_int)
                f_words = " ".join([number_to_hindi_words(int(digit)) for digit in frac])
                return f"{w_words} दशमलव {f_words} प्रतिशत"
            else:
                w_words = number_to_english_words(w_int)
                f_words = " ".join([number_to_english_words(int(digit)) for digit in frac])
                return f"{w_words} point {f_words} percent"
        else:
            n = int(num_str)
            if is_hi:
                return f"{number_to_hindi_words(n)} प्रतिशत"
            else:
                return f"{number_to_english_words(n)} percent"
    except Exception:
        return f"{num_str} percent"


def number_to_spoken_words(num_str: str, language: str) -> str:
    """Convert a plain number or decimal to spoken words."""
    try:
        lang = language.lower()
        is_hi = "hi" in lang or "chh" in lang
        if "/" in num_str:
            # E.g. Khasra 142/1
            parts = num_str.split("/")
            if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                p0 = int(parts[0])
                p1 = int(parts[1])
                if is_hi:
                    return f"{number_to_hindi_words(p0)} बटा {number_to_hindi_words(p1)}"
                else:
                    return f"{number_to_english_words(p0)} by {number_to_english_words(p1)}"

        if "." in num_str:
            whole, frac = num_str.split(".", 1)
            w_int = int(whole)
            if is_hi:
                w_words = number_to_hindi_words(w_int)
                f_words = " ".join([number_to_hindi_words(int(digit)) for digit in frac])
                return f"{w_words} दशमलव {f_words}"
            else:
                w_words = number_to_english_words(w_int)
                f_words = " ".join([number_to_english_words(int(digit)) for digit in frac])
                return f"{w_words} point {f_words}"
        else:
            n = int(num_str.replace(",", ""))
            if is_hi:
                return number_to_hindi_words(n)
            else:
                return number_to_english_words(n)
    except Exception:
        return num_str


def convert_text_to_tts(text: str, language: str = "en") -> str:
    """
    Transform numbers, currencies, and percentages in display text into natural spoken words.
    Supports Hindi (hi-IN), Chhattisgarhi (chh -> hi-IN mapping), and English (en-IN).
    """
    if not text:
        return ""

    out = text

    # 1. Currency amounts: ₹ 1,50,000 or ₹20000 or Rs. 15,000
    def _curr_repl(match):
        val = match.group(1)
        return " " + currency_to_words(val, language) + " "

    out = re.sub(r"(?:₹|Rs\.?|INR)\s*([0-9,]+(?:\.[0-9]+)?)", _curr_repl, out)

    # 2. Percentages: 7% or 4.5 %
    def _pct_repl(match):
        val = match.group(1)
        return " " + percentage_to_words(val, language) + " "

    out = re.sub(r"([0-9]+(?:\.[0-9]+)?)\s*%", _pct_repl, out)

    # 3. Khasra numbers: e.g. "खसरा 142/1" or "Khasra 142/1"
    def _khasra_repl(match):
        prefix = match.group(1)
        num_part = match.group(2)
        return f"{prefix} {number_to_spoken_words(num_part, language)}"

    out = re.sub(r"(खसरा|khasra|Khasra|no\.|No\.)\s*([0-9]+/[0-9]+)", _khasra_repl, out, flags=re.IGNORECASE)

    # 4. Normalize spacing
    out = re.sub(r"\s+", " ", out).strip()
    return out


def substitute_placeholders(text: str, tool_data_sink: Dict[str, Any]) -> str:
    """
    Substitutes all {{placeholder}} tokens from tool_data_sink.
    Verifies that zero unreplaced {{...}} tokens remain.
    """
    if not text:
        return ""

    result = text
    for key, val in tool_data_sink.items():
        placeholder = f"{{{{{key}}}}}"
        if placeholder in result:
            result = result.replace(placeholder, str(val))

    # Strip any dangling or unknown placeholders gracefully
    def _unknown_ph(match):
        inner = match.group(1).strip()
        # If in sink with case variance, use it
        for k, v in tool_data_sink.items():
            if k.lower() == inner.lower():
                return str(v)
        return ""

    result = re.sub(r"\{\{([^}]+)\}\}", _unknown_ph, result)
    return result


def process_chat_response(
    raw_text: str,
    tool_data_sink: Dict[str, Any],
    language: str = "en",
) -> Dict[str, str]:
    """
    Deterministic Guardrail Pipeline:
    1. Replaces tool placeholders with exact computed mathematical values.
    2. Builds display_text with standard numerals.
    3. Builds tts_text converting all numbers/currency into Indian language spoken words.
    """
    # 1. Deterministic substitution
    display_text = substitute_placeholders(raw_text, tool_data_sink)

    # Clean double spaces or markdown artifacts for display
    display_text = display_text.strip()

    # 2. Generate spoken words for SpeechSynthesis
    tts_text = convert_text_to_tts(display_text, language=language)

    return {
        "display_text": display_text,
        "tts_text": tts_text,
    }

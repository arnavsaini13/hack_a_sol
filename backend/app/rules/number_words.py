"""
Hindi number-to-words converter (Indian lakh/crore system).
Pure function — no web, DB, or LLM imports.

Covers: 0, ones, teens, tens, hundreds, thousands, lakh, crore.
Used for speech_text templates where numbers must be spoken as words.
"""


_ONES = [
    "", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ",
    "दस", "ग्यारह", "बारह", "तेरह", "चौदह", "पंद्रह", "सोलह", "सत्रह",
    "अठारह", "उन्नीस", "बीस", "इक्कीस", "बाईस", "तेईस", "चौबीस",
    "पच्चीस", "छब्बीस", "सत्ताईस", "अट्ठाईस", "उनतीस", "तीस",
    "इकतीस", "बत्तीस", "तैंतीस", "चौंतीस", "पैंतीस", "छत्तीस",
    "सैंतीस", "अड़तीस", "उनतालीस", "चालीस", "इकतालीस", "बयालीस",
    "तैंतालीस", "चवालीस", "पैंतालीस", "छियालीस", "सैंतालीस",
    "अड़तालीस", "उनचास", "पचास", "इक्यावन", "बावन", "तिरपन",
    "चौवन", "पचपन", "छप्पन", "सत्तावन", "अट्ठावन", "उनसठ", "साठ",
    "इकसठ", "बासठ", "तिरसठ", "चौंसठ", "पैंसठ", "छियासठ", "सड़सठ",
    "अड़सठ", "उनहत्तर", "सत्तर", "इकहत्तर", "बहत्तर", "तिहत्तर",
    "चौहत्तर", "पचहत्तर", "छिहत्तर", "सतहत्तर", "अठहत्तर",
    "उन्यासी", "अस्सी", "इक्यासी", "बयासी", "तिरासी", "चौरासी",
    "पचासी", "छियासी", "सत्तासी", "अट्ठासी", "नवासी", "नब्बे",
    "इक्यानबे", "बानबे", "तिरानबे", "चौरानबे", "पचानबे", "छियानबे",
    "सत्तानबे", "अट्ठानबे", "निन्यानबे"
]


def number_to_hindi_words(n: int) -> str:
    """Convert a non-negative integer to Hindi words using the Indian system.

    Examples:
        0 → 'शून्य'
        1 → 'एक'
        21 → 'इक्कीस'
        100 → 'एक सौ'
        1000 → 'एक हज़ार'
        100000 → 'एक लाख'
        10000000 → 'एक करोड़'
        153783 → 'एक लाख तिरपन हज़ार सात सौ तिरासी'
        41517 → 'इकतालीस हज़ार पाँच सौ सत्रह'
    """
    if not isinstance(n, int) or n < 0:
        raise ValueError(f"Expected non-negative integer, got {n!r}")

    if n == 0:
        return "शून्य"

    parts = []

    # Crore (10^7)
    crore = n // 10000000
    if crore > 0:
        if crore <= 99:
            parts.append(_ONES[crore])
        else:
            parts.append(number_to_hindi_words(crore))
        parts.append("करोड़")
        n %= 10000000

    # Lakh (10^5)
    lakh = n // 100000
    if lakh > 0:
        parts.append(_ONES[lakh])
        parts.append("लाख")
        n %= 100000

    # Thousand (10^3)
    thousand = n // 1000
    if thousand > 0:
        parts.append(_ONES[thousand])
        parts.append("हज़ार")
        n %= 1000

    # Hundreds
    hundreds = n // 100
    if hundreds > 0:
        parts.append(_ONES[hundreds])
        parts.append("सौ")
        n %= 100

    # Ones and tens (0-99)
    if n > 0:
        parts.append(_ONES[n])

    return " ".join(parts)


def rupees_to_hindi_words(paise: int) -> str:
    """Convert integer paise to Hindi words for rupees.

    Example: 15378300 → 'एक लाख तिरपन हज़ार सात सौ तिरासी रुपये'
    """
    from decimal import Decimal, ROUND_HALF_UP
    rupees = int((Decimal(paise) / Decimal(100)).to_integral_value(rounding=ROUND_HALF_UP))
    words = number_to_hindi_words(rupees)
    return f"{words} रुपये"


def _hindi_words_to_number(text: str) -> int:
    """Parse Hindi number words back to an integer.

    Used for the round-trip test: spoken words → number → verify equals engine amount.
    Handles: शून्य, ones 1-99, सौ, हज़ार, लाख, करोड़.
    """
    text = text.strip()
    if text == "शून्य":
        return 0

    # Remove 'रुपये' suffix if present
    text = text.replace("रुपये", "").strip()

    # Build reverse lookup
    word_to_num = {}
    for i, w in enumerate(_ONES):
        if w:
            word_to_num[w] = i

    tokens = text.split()
    total = 0
    current = 0
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if token == "करोड़":
            current = max(current, 1) * 10000000
            total += current
            current = 0
        elif token == "लाख":
            current = max(current, 1) * 100000
            total += current
            current = 0
        elif token == "हज़ार":
            current = max(current, 1) * 1000
            total += current
            current = 0
        elif token == "सौ":
            current = max(current, 1) * 100
        elif token in word_to_num:
            current += word_to_num[token]
        i += 1

    total += current
    return total


# ── English Number Words (Indian System: Lakh / Crore) ────────────────

_EN_ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
]

_EN_TENS = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
]


def _two_digits_to_en(n: int) -> str:
    if n < 20:
        return _EN_ONES[n]
    tens = n // 10
    ones = n % 10
    if ones == 0:
        return _EN_TENS[tens]
    return f"{_EN_TENS[tens]}-{_EN_ONES[ones]}"


def number_to_english_words(n: int) -> str:
    """Convert a non-negative integer to English words in Indian lakh/crore system."""
    if not isinstance(n, int) or n < 0:
        raise ValueError(f"Expected non-negative integer, got {n!r}")
    if n == 0:
        return "Zero"

    parts = []
    # Crore (10^7)
    crore = n // 10000000
    if crore > 0:
        parts.append(f"{number_to_english_words(crore)} Crore")
        n %= 10000000

    # Lakh (10^5)
    lakh = n // 100000
    if lakh > 0:
        parts.append(f"{_two_digits_to_en(lakh)} Lakh")
        n %= 100000

    # Thousand (10^3)
    thousand = n // 1000
    if thousand > 0:
        parts.append(f"{_two_digits_to_en(thousand)} Thousand")
        n %= 1000

    # Hundred (10^2)
    hundred = n // 100
    if hundred > 0:
        parts.append(f"{_EN_ONES[hundred]} Hundred")
        n %= 100

    # Ones and tens (0-99)
    if n > 0:
        parts.append(_two_digits_to_en(n))

    return " ".join(parts)


def rupees_to_english_words(paise: int) -> str:
    """Convert integer paise to English words for rupees in Indian system."""
    from decimal import Decimal, ROUND_HALF_UP
    rupees = int((Decimal(paise) / Decimal(100)).to_integral_value(rounding=ROUND_HALF_UP))
    words = number_to_english_words(rupees)
    return f"{words} Rupees"



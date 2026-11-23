"""
Conversion and display helpers.
Pure functions — no web, DB, or LLM imports.
"""
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

# ── Conversion constant (defined once) ──────────────────────────────
HA_TO_ACRES_FACTOR = Decimal("2.47105")


def ha_to_acres(hectares: Decimal) -> Decimal:
    """Convert hectares to acres.  THE ONLY place this conversion happens."""
    if not isinstance(hectares, Decimal):
        hectares = Decimal(str(hectares))
    return hectares * HA_TO_ACRES_FACTOR


def paise_to_rupees(paise: int) -> Decimal:
    """Convert integer paise to Decimal rupees."""
    return Decimal(paise) / Decimal(100)


def rupees_to_paise(rupees: Decimal) -> int:
    """Convert Decimal rupees to integer paise, rounding half-up."""
    if not isinstance(rupees, Decimal):
        rupees = Decimal(str(rupees))
    return int((rupees * Decimal(100)).to_integral_value(rounding=ROUND_HALF_UP))


def display_rupees(paise: int) -> str:
    """Format integer paise as a display string with Indian grouping.

    Example: 15378300 → '₹1,53,783'

    Rounding: half-up to the nearest rupee.
    This is the ONLY place display rounding happens.
    """
    rupees = Decimal(paise) / Decimal(100)
    rupees_int = int(rupees.to_integral_value(rounding=ROUND_HALF_UP))
    return "₹" + _indian_grouping(rupees_int)


def _indian_grouping(n: int) -> str:
    """Format an integer with Indian-style grouping (1,53,783)."""
    if n < 0:
        return "-" + _indian_grouping(-n)
    s = str(n)
    if len(s) <= 3:
        return s
    # Last 3 digits, then groups of 2
    last3 = s[-3:]
    rest = s[:-3]
    groups = []
    while len(rest) > 2:
        groups.append(rest[-2:])
        rest = rest[:-2]
    if rest:
        groups.append(rest)
    groups.reverse()
    return ",".join(groups) + "," + last3


def format_indian_number(n: int | Decimal | float) -> str:
    """Format a number with Indian grouping commas (e.g. 153783 -> '1,53,783')."""
    if isinstance(n, Decimal):
        n_int = int(n.to_integral_value(rounding=ROUND_HALF_UP))
    elif isinstance(n, float):
        n_int = int(round(n))
    else:
        n_int = int(n)
    return _indian_grouping(n_int)


def display_rupees_decimal(rupees: Decimal) -> str:
    """Format a Decimal rupees value with Indian grouping.
    Rounds half-up to the nearest rupee.
    """
    return display_rupees(rupees_to_paise(rupees))


def paddy_quantity_cap(acres: Decimal, cap_per_acre: int = 21) -> Decimal:
    """Calculate the paddy quantity cap: acres × cap_per_acre quintals.

    Rounded half-up to 2 decimal places.
    Defined ONCE and tested.
    """
    if not isinstance(acres, Decimal):
        acres = Decimal(str(acres))
    raw = acres * Decimal(str(cap_per_acre))
    return raw.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def quantize_2dp(value: Decimal) -> Decimal:
    """Round a Decimal to 2 decimal places, half-up."""
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


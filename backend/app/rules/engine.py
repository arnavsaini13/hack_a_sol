"""
Pure rules engine — ZERO AI MATH.

This module computes all entitlements, discrepancies, and rejection verdicts
from rules_2026.json using pure Python. 

IMPORT RESTRICTIONS (enforced by test):
  - Must NOT import: fastapi, sqlalchemy, httpx, requests, or any LLM SDK.
  - May only import: stdlib, decimal, json, pathlib, datetime, typing, 
    and sibling modules (helpers, number_words).
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any, Literal

from .helpers import (
    HA_TO_ACRES_FACTOR,
    ha_to_acres,
    paddy_quantity_cap,
    paise_to_rupees,
    rupees_to_paise,
    quantize_2dp,
)

# ── Load rules ──────────────────────────────────────────────────────
_RULES_PATH = Path(__file__).parent / "rules_2026.json"


def load_rules() -> dict[str, Any]:
    """Load rules_2026.json and index by rule_id."""
    with open(_RULES_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return {r["rule_id"]: r for r in data["rules"]}


def rules_meta() -> dict[str, str]:
    with open(_RULES_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return data["meta"]


RULES = load_rules()


def get_rule_value(rule_id: str) -> Any:
    return RULES[rule_id]["value"]


def get_rule(rule_id: str) -> dict[str, Any]:
    return RULES[rule_id]


# ── Data classes for inputs / outputs ───────────────────────────────

@dataclass
class ParcelInfo:
    farm_id: str
    district: str
    tehsil: str
    village: str
    khasra_no: str
    hectares: Decimal          # Decimal, 4 dp
    girdawari_crop: str
    girdawari_ha: Decimal      # paddy area from Girdawari


@dataclass
class LoanInfo:
    loan_id: str
    farm_id: str
    lender_type: str           # "PACS" | "cooperative" | "RRB" | "commercial"
    principal_paise: int
    duration_months: int
    timely_repayment: bool
    interest_charged_paise: int  # what the bank actually charged
    is_kcc: bool = True
    is_active: bool = True
    is_subsidised: bool = True


@dataclass
class ProcurementInfo:
    farmer_id: str
    farm_id: str
    crop: str
    quantity_quintals: Decimal
    moisture_percent: Decimal
    grade: str                  # "Common" | "Grade A"
    msp_paid_paise: int
    kuy_paid_paise: int
    kuy_expected_release_date: date | None


@dataclass
class InsuranceUnitInfo:
    village_code: str
    farm_id: str
    season: str                # "Kharif" | "Rabi"
    crop: str
    sum_insured_per_ha: int    # paise
    average_yield: Decimal     # quintals per ha
    indemnity_level: Decimal   # fraction e.g. 0.90
    cce_yield: Decimal | None  # quintals per ha; None = not yet assessed
    cutoff_date: date
    insured_ha: Decimal


# ── KCC / Cooperative Loan Calculator (FA4) ─────────────────────────

@dataclass
class KCCResult:
    loan_id: str
    farm_id: str
    lender_type: str
    principal_paise: int
    base_rate_percent: Decimal
    subvention_percent: Decimal
    effective_rate_percent: Decimal
    entitled_interest_paise: int
    actual_interest_paise: int
    overcharge_paise: int
    timely: bool
    collateral_note: str
    cap_note: str
    rules_used: list[str]


def calculate_kcc(loan: LoanInfo) -> KCCResult:
    """Calculate entitled interest for a KCC / cooperative loan."""
    rules_used = []

    if loan.lender_type in ("PACS", "cooperative"):
        base_rate = Decimal(0)
        subvention = Decimal(0)
        effective = Decimal(0) if loan.timely_repayment else Decimal(str(get_rule_value("RRB_BASE_RATE")))
        rules_used.append("PACS_INTEREST_RATE_TIMELY")
    else:
        # RRB / commercial
        base_rate = Decimal(str(get_rule_value("RRB_BASE_RATE")))
        subvention = Decimal(str(get_rule_value("RRB_SUBVENTION"))) if loan.timely_repayment else Decimal(0)
        effective = base_rate - subvention
        rules_used.extend(["RRB_BASE_RATE", "RRB_SUBVENTION"])

    # Calculate entitled interest in paise
    # Simple interest: P × R × T / 100
    principal_rupees = Decimal(loan.principal_paise) / Decimal(100)
    duration_years = Decimal(loan.duration_months) / Decimal(12)
    entitled_rupees = principal_rupees * effective * duration_years / Decimal(100)
    entitled_paise = int(entitled_rupees.to_integral_value(rounding=ROUND_HALF_UP)) * 100

    overcharge = max(0, loan.interest_charged_paise - entitled_paise)

    # Collateral note
    collateral_free_limit = get_rule_value("COLLATERAL_FREE_LIMIT")
    if loan.principal_paise <= collateral_free_limit:
        collateral_note = "collateral_free"
    else:
        collateral_note = "collateral_required"
    rules_used.append("COLLATERAL_FREE_LIMIT")

    # Cap note
    operational_cap = get_rule_value("OPERATIONAL_LOAN_CAP")
    if loan.principal_paise > operational_cap:
        cap_note = "above_cap"
    else:
        cap_note = "within_cap"
    rules_used.extend(["OPERATIONAL_LOAN_CAP", "ANNOUNCED_LOAN_CAP"])

    return KCCResult(
        loan_id=loan.loan_id,
        farm_id=loan.farm_id,
        lender_type=loan.lender_type,
        principal_paise=loan.principal_paise,
        base_rate_percent=base_rate,
        subvention_percent=subvention,
        effective_rate_percent=effective,
        entitled_interest_paise=entitled_paise,
        actual_interest_paise=loan.interest_charged_paise,
        overcharge_paise=overcharge,
        timely=loan.timely_repayment,
        collateral_note=collateral_note,
        cap_note=cap_note,
        rules_used=rules_used,
    )


# ── Paddy MSP + KUY Calculator (FA5) ───────────────────────────────

@dataclass
class MSPResult:
    parcels: list[MSPParcelResult]
    total_girdawari_acres: Decimal
    total_cap_quintals: Decimal
    total_quantity_sold: Decimal
    excess_quintals: Decimal
    total_msp_entitled_paise: int
    total_kuy_entitled_paise: int
    total_msp_paid_paise: int
    total_kuy_paid_paise: int
    msp_shortfall_paise: int
    kuy_shortfall_paise: int
    moisture_alert: str | None      # None, "amber", "red"
    kuy_status: str                 # "pending" | "due" | "overdue"
    kuy_overdue_days: int
    rules_used: list[str]


@dataclass
class MSPParcelResult:
    farm_id: str
    girdawari_acres: Decimal
    cap_quintals: Decimal
    quantity_sold: Decimal
    excess: Decimal
    msp_entitled_paise: int
    kuy_entitled_paise: int


def calculate_msp(
    parcels: list[ParcelInfo],
    procurement: list[ProcurementInfo],
    today: date | None = None,
) -> MSPResult:
    """Calculate MSP + KUY entitlement across all parcels."""
    if today is None:
        today = date.today()

    rules_used = ["MSP_PADDY_COMMON", "MSP_PADDY_GRADE_A", "KUY_BONUS",
                   "PADDY_QTY_CAP_PER_ACRE", "MOISTURE_THRESHOLD", "MSP_CAP_PER_FARMER"]

    cap_per_acre = get_rule_value("PADDY_QTY_CAP_PER_ACRE")
    msp_common = get_rule_value("MSP_PADDY_COMMON")
    msp_grade_a = get_rule_value("MSP_PADDY_GRADE_A")
    kuy_bonus = get_rule_value("KUY_BONUS")
    moisture_threshold = get_rule_value("MOISTURE_THRESHOLD")

    # Compute per-parcel caps
    parcel_results = []
    total_girdawari_acres = Decimal(0)
    total_cap = Decimal(0)

    for p in parcels:
        if p.girdawari_crop and p.girdawari_crop.lower() in ("paddy", "धान"):
            acres = ha_to_acres(p.girdawari_ha)
            cap = paddy_quantity_cap(acres, cap_per_acre)
            total_girdawari_acres += acres
            total_cap += cap
            parcel_results.append(MSPParcelResult(
                farm_id=p.farm_id,
                girdawari_acres=quantize_2dp(acres),
                cap_quintals=cap,
                quantity_sold=Decimal(0),
                excess=Decimal(0),
                msp_entitled_paise=0,
                kuy_entitled_paise=0,
            ))

    total_girdawari_acres = quantize_2dp(total_girdawari_acres)
    total_cap = paddy_quantity_cap(total_girdawari_acres, cap_per_acre)

    # Aggregate procurement across parcels
    total_qty = Decimal(0)
    total_msp_paid = 0
    total_kuy_paid = 0
    kuy_release_date: date | None = None
    max_moisture = Decimal(0)
    grade = "Common"

    for proc in procurement:
        if proc.crop.lower() in ("paddy", "धान"):
            total_qty += proc.quantity_quintals
            total_msp_paid += proc.msp_paid_paise
            total_kuy_paid += proc.kuy_paid_paise
            if proc.kuy_expected_release_date:
                if kuy_release_date is None or proc.kuy_expected_release_date > kuy_release_date:
                    kuy_release_date = proc.kuy_expected_release_date
            if proc.moisture_percent > max_moisture:
                max_moisture = proc.moisture_percent
            if proc.grade == "Grade A":
                grade = "Grade A"

    # Eligible quantity (capped)
    eligible_qty = min(total_qty, total_cap)
    excess = max(Decimal(0), total_qty - total_cap)

    # MSP entitled
    msp_rate = msp_grade_a if grade == "Grade A" else msp_common
    msp_entitled = int(eligible_qty * Decimal(msp_rate))

    # KUY entitled
    kuy_entitled = int(eligible_qty * Decimal(kuy_bonus))

    # Shortfalls
    tolerance = get_rule_value("ROUNDING_TOLERANCE_PAISE")
    msp_shortfall = max(0, msp_entitled - total_msp_paid)
    kuy_shortfall = max(0, kuy_entitled - total_kuy_paid)

    # Moisture alert
    moisture_alert = None
    if max_moisture > Decimal(str(moisture_threshold)):
        if max_moisture > Decimal("20"):
            moisture_alert = "red"
        else:
            moisture_alert = "amber"

    # KUY status
    if kuy_release_date is None:
        kuy_status = "pending"
        kuy_overdue_days = 0
    elif today < kuy_release_date:
        kuy_status = "pending"
        kuy_overdue_days = 0
    elif today == kuy_release_date:
        kuy_status = "due"
        kuy_overdue_days = 0
    else:
        kuy_status = "overdue"
        kuy_overdue_days = (today - kuy_release_date).days

    # Distribute proportionally to parcels
    if total_cap > 0:
        for pr in parcel_results:
            share = pr.cap_quintals / total_cap
            pr.quantity_sold = quantize_2dp(total_qty * share)
            pr.excess = quantize_2dp(excess * share)
            pr.msp_entitled_paise = int(Decimal(msp_entitled) * share)
            pr.kuy_entitled_paise = int(Decimal(kuy_entitled) * share)

    return MSPResult(
        parcels=parcel_results,
        total_girdawari_acres=total_girdawari_acres,
        total_cap_quintals=total_cap,
        total_quantity_sold=total_qty,
        excess_quintals=excess,
        total_msp_entitled_paise=msp_entitled,
        total_kuy_entitled_paise=kuy_entitled,
        total_msp_paid_paise=total_msp_paid,
        total_kuy_paid_paise=total_kuy_paid,
        msp_shortfall_paise=msp_shortfall,
        kuy_shortfall_paise=kuy_shortfall,
        moisture_alert=moisture_alert,
        kuy_status=kuy_status,
        kuy_overdue_days=kuy_overdue_days,
        rules_used=rules_used,
    )


# ── PMFBY Calculator (FA6) ─────────────────────────────────────────

@dataclass
class PMFBYResult:
    farm_id: str
    season: str
    premium_cap_percent: Decimal
    farmer_premium_paise: int
    sum_insured_paise: int
    threshold_yield: Decimal
    cce_yield: Decimal | None
    claim_paise: int
    claim_eligible: bool
    settlement_due_date: date
    settlement_overdue: bool
    rules_used: list[str]


def calculate_pmfby(
    unit: InsuranceUnitInfo,
    today: date | None = None,
) -> PMFBYResult:
    """Calculate PMFBY premium cap and claim for one parcel/insurance-unit."""
    if today is None:
        today = date.today()

    rules_used = ["PMFBY_PREMIUM_KHARIF", "PMFBY_PREMIUM_RABI",
                   "PMFBY_PREMIUM_COMMERCIAL", "PMFBY_INDEMNITY_LEVEL",
                   "PMFBY_SETTLEMENT_DAYS"]

    # Premium cap by season
    if unit.season.lower() == "kharif":
        cap_pct = Decimal(str(get_rule_value("PMFBY_PREMIUM_KHARIF")))
    elif unit.season.lower() == "rabi":
        cap_pct = Decimal(str(get_rule_value("PMFBY_PREMIUM_RABI")))
    else:
        cap_pct = Decimal(str(get_rule_value("PMFBY_PREMIUM_COMMERCIAL")))

    # Sum insured
    sum_insured_paise = int(Decimal(unit.sum_insured_per_ha) * unit.insured_ha)

    # Farmer premium
    farmer_premium = int(
        (Decimal(sum_insured_paise) * cap_pct / Decimal(100))
        .to_integral_value(rounding=ROUND_HALF_UP)
    )

    # Threshold yield = average yield × indemnity level
    indemnity = unit.indemnity_level
    threshold = quantize_2dp(unit.average_yield * indemnity)

    # Claim = max(0, (threshold - CCE) / threshold × sum_insured)
    claim_paise = 0
    claim_eligible = False
    if unit.cce_yield is not None and unit.cce_yield < threshold:
        shortfall = threshold - unit.cce_yield
        claim_ratio = shortfall / threshold
        claim_paise = int(
            (Decimal(sum_insured_paise) * claim_ratio)
            .to_integral_value(rounding=ROUND_HALF_UP)
        )
        claim_eligible = True

    # Settlement due date
    settlement_days = get_rule_value("PMFBY_SETTLEMENT_DAYS")
    settlement_due = unit.cutoff_date + timedelta(days=settlement_days)
    settlement_overdue = today > settlement_due

    return PMFBYResult(
        farm_id=unit.farm_id,
        season=unit.season,
        premium_cap_percent=cap_pct,
        farmer_premium_paise=farmer_premium,
        sum_insured_paise=sum_insured_paise,
        threshold_yield=threshold,
        cce_yield=unit.cce_yield,
        claim_paise=claim_paise,
        claim_eligible=claim_eligible,
        settlement_due_date=settlement_due,
        settlement_overdue=settlement_overdue,
        rules_used=rules_used,
    )


# ── Discrepancy Detector (FA8) ─────────────────────────────────────

DiscrepancyState = Literal[
    "PENDING", "DUE", "OVERDUE", "PAID", "PARTIALLY_PAID",
    "UNDERPAID", "OVERCHARGED", "REJECTED"
]


@dataclass
class DiscrepancyLine:
    farm_id: str
    scheme: str
    entitled_paise: int
    received_paise: int
    difference_paise: int
    state: DiscrepancyState
    overdue_days: int
    alert: bool


def detect_discrepancy(
    entitled_paise: int,
    received_paise: int,
    due_date: date | None,
    today: date | None,
    scheme: str,
    farm_id: str,
    rejected: bool = False,
) -> DiscrepancyLine:
    """Detect discrepancy between entitled and received amounts."""
    if today is None:
        today = date.today()

    tolerance = get_rule_value("ROUNDING_TOLERANCE_PAISE")
    diff = entitled_paise - received_paise
    overdue_days = 0

    if rejected:
        state: DiscrepancyState = "REJECTED"
    elif received_paise == 0 and due_date is not None:
        if today < due_date:
            state = "PENDING"
        elif today == due_date:
            state = "DUE"
        else:
            state = "OVERDUE"
            overdue_days = (today - due_date).days
    elif abs(diff) <= tolerance:
        state = "PAID"
    elif diff > tolerance:
        if received_paise > 0:
            state = "UNDERPAID"
        elif due_date and today > due_date:
            state = "OVERDUE"
            overdue_days = (today - due_date).days
        elif due_date and today < due_date:
            state = "PENDING"
        else:
            state = "DUE"
    elif diff < -tolerance:
        # received more than entitled — shouldn't normally happen,
        # but could indicate overcharge on the payer side
        state = "OVERCHARGED"
    else:
        state = "PAID"

    alert = state in ("UNDERPAID", "OVERCHARGED", "REJECTED", "OVERDUE")

    return DiscrepancyLine(
        farm_id=farm_id,
        scheme=scheme,
        entitled_paise=entitled_paise,
        received_paise=received_paise,
        difference_paise=diff,
        state=state,
        overdue_days=overdue_days,
        alert=alert,
    )


# ── Interest overcharge detector ────────────────────────────────────

def detect_interest_overcharge(
    kcc: KCCResult,
) -> DiscrepancyLine:
    """Detect overcharge on a KCC loan."""
    return detect_discrepancy(
        entitled_paise=kcc.entitled_interest_paise,
        received_paise=kcc.actual_interest_paise,
        due_date=None,
        today=None,
        scheme="KCC_INTEREST",
        farm_id=kcc.farm_id,
    )


# ── Rejection Explainer (FA9) ──────────────────────────────────────

REASON_CODES = {
    "IDENTITY_FATHER_MISMATCH": {
        "trust": "Verified",
        "department": "Bank",
        "hi": {
            "display_text": "पिता का नाम भूमि रिकॉर्ड से मेल नहीं खाता।",
            "speech_text": "पिता का नाम भूमि रिकॉर्ड से मेल नहीं खाता।",
            "correction": "बी-वन में वर्तनी जाँचें; गलत होने पर रिकॉर्ड सुधार का अनुरोध करें; फिर से आवेदन करें।",
            "documents": "पहचान पत्र, बी-वन/पी-दो",
            "authority": "बैंक शाखा; पटवारी / तहसील",
        },
        "en": {
            "display_text": "Father's name differs from land record.",
            "speech_text": "Father's name differs from land record.",
            "correction": "Check spelling in B-I; request record correction if the record is wrong; reapply.",
            "documents": "ID proof, B-I/P-II",
            "authority": "Bank branch; Patwari / Tehsil",
        },
    },
    "IDENTITY_SPELLING_REVIEW": {
        "trust": "Verified",
        "department": "Bank",
        "hi": {
            "display_text": "नाम में मामूली वर्तनी भिन्नता, मैनुअल जाँच आवश्यक।",
            "speech_text": "नाम में मामूली वर्तनी भिन्नता, मैनुअल जाँच आवश्यक।",
            "correction": "पहचान पत्र और बी-वन लेकर शाखा जाएँ; अधिकारी जाँच करेगा।",
            "documents": "पहचान पत्र, बी-वन",
            "authority": "बैंक शाखा",
        },
        "en": {
            "display_text": "Minor spelling drift, manual ID check needed.",
            "speech_text": "Minor spelling drift, manual ID check needed.",
            "correction": "Bring ID and B-I; officer verifies.",
            "documents": "ID proof, B-I",
            "authority": "Bank branch",
        },
    },
    "KHASRA_NOT_FOUND": {
        "trust": "Verified",
        "department": "Revenue",
        "hi": {
            "display_text": "इस ज़िले, तहसील, गाँव और खसरा का कोई रिकॉर्ड नहीं मिला।",
            "speech_text": "खसरा नंबर नहीं मिला। बी-वन या पी-दो में गाँव और खसरा की जाँच करें।",
            "correction": "बी-वन/पी-दो पर गाँव और खसरा दोबारा जाँचें; भौतिक रिकॉर्ड जाँच कराएँ।",
            "documents": "बी-वन/पी-दो",
            "authority": "पटवारी / तहसील",
        },
        "en": {
            "display_text": "Khasra Not Found — Verify Physical B-I/P-II.",
            "speech_text": "Khasra not found. Recheck village and Khasra on B-I or P-II.",
            "correction": "Recheck village and Khasra on B-I/P-II; physical record check.",
            "documents": "B-I/P-II",
            "authority": "Patwari / Tehsil",
        },
    },
    "DUPLICATE_ACTIVE_KCC_MISS": {
        "trust": "Verified",
        "department": "Bank",
        "hi": {
            "display_text": "इस भूखंड पर पहले से एक सब्सिडी वाला केसीसी सक्रिय है।",
            "speech_text": "इस ज़मीन पर पहले से एक सब्सिडी वाला केसीसी ऋण चल रहा है।",
            "correction": "मौजूदा केसीसी बंद करें या किसी दूसरे भूखंड पर आवेदन करें।",
            "documents": "मौजूदा ऋण विवरण",
            "authority": "मौजूदा ऋणदाता; बैंक शाखा",
        },
        "en": {
            "display_text": "Subsidised KCC already active on this parcel.",
            "speech_text": "A subsidised KCC loan is already active on this land parcel.",
            "correction": "Settle or close existing KCC, or apply for a different parcel.",
            "documents": "Existing loan statement",
            "authority": "Existing lender; bank branch",
        },
    },
    "ACTIVE_MORTGAGE": {
        "trust": "Verified",
        "department": "Bank",
        "hi": {
            "display_text": "भूखंड किसी अन्य ऋणदाता के पास गिरवी है।",
            "speech_text": "यह ज़मीन किसी अन्य ऋणदाता के पास गिरवी रखी हुई है।",
            "correction": "एनओसी प्राप्त करें या गिरवी हटवाएँ, फिर आवेदन करें।",
            "documents": "एनओसी या गिरवी मुक्ति प्रमाण",
            "authority": "मौजूदा ऋणदाता",
        },
        "en": {
            "display_text": "Parcel mortgaged with another lender.",
            "speech_text": "This land is mortgaged with another lender.",
            "correction": "Obtain NOC or clear the mortgage, then apply.",
            "documents": "NOC or mortgage clearance certificate",
            "authority": "Existing lender",
        },
    },
    "CO_OWNER_NOC_REQUIRED": {
        "trust": "Verified",
        "department": "Bank",
        "hi": {
            "display_text": "सह-मालिक सूचीबद्ध हैं; संयुक्त एनओसी आवश्यक है या सीमा यथानुपात होगी।",
            "speech_text": "इस ज़मीन के सह-मालिक हैं। संयुक्त एनओसी चाहिए या ऋण सीमा कम होगी।",
            "correction": "सह-मालिक का एनओसी लेकर बैंक जाएँ।",
            "documents": "सह-मालिक एनओसी",
            "authority": "बैंक शाखा",
        },
        "en": {
            "display_text": "Co-owners listed; joint NOC needed or limit pro-rated.",
            "speech_text": "Co-owners are listed on this land. Joint NOC is needed or the loan limit will be reduced.",
            "correction": "Collect co-owner NOC.",
            "documents": "Co-owner NOC",
            "authority": "Bank branch",
        },
    },
    "OVER_FINANCING_LIMIT": {
        "trust": "Verified",
        "department": "Bank",
        "hi": {
            "display_text": "राशि क्षेत्रफल और हिस्सेदारी की सीमा से अधिक है।",
            "speech_text": "माँगी गई राशि ज़मीन के क्षेत्रफल और हिस्सेदारी की सीमा से अधिक है।",
            "correction": "दिखाई गई सीमा के भीतर आवेदन करें।",
            "documents": "भूमि रिकॉर्ड",
            "authority": "बैंक शाखा",
        },
        "en": {
            "display_text": "Amount above limit for area and share.",
            "speech_text": "The requested amount exceeds the limit for the land area and ownership share.",
            "correction": "Apply within the shown limit.",
            "documents": "Land records",
            "authority": "Bank branch",
        },
    },
    "KUY_NOT_YET_DUE": {
        "trust": "Rule",
        "department": "Procurement",
        "hi": {
            "display_text": "कृषक उन्नति योजना की राशि अभी देय नहीं हुई है।",
            "speech_text": "कृषक उन्नति योजना की राशि अभी देय नहीं हुई है। तय तारीख़ का इंतज़ार करें।",
            "correction": "तय तारीख़ का इंतज़ार करें; अभी शिकायत की ज़रूरत नहीं।",
            "documents": "",
            "authority": "कोई नहीं",
        },
        "en": {
            "display_text": "KUY amount not yet due.",
            "speech_text": "The Krishak Unnati Yojana amount is not yet due. Wait until the release date.",
            "correction": "Wait until the date; no complaint yet.",
            "documents": "",
            "authority": "None",
        },
    },
    "KUY_OVERDUE": {
        "trust": "Rule",
        "department": "Procurement",
        "hi": {
            "display_text": "कृषक उन्नति योजना की राशि तय तारीख़ से विलंबित है।",
            "speech_text": "कृषक उन्नति योजना की राशि तय तारीख़ बीत जाने के बाद भी नहीं आई।",
            "correction": "शिकायत पत्र बनाएँ; 15 दिन बाद अनुवर्ती कार्रवाई करें।",
            "documents": "प्रापण रसीद",
            "authority": "ज़िला प्रापण अधिकारी",
        },
        "en": {
            "display_text": "KUY amount overdue — release date has passed, not credited.",
            "speech_text": "The Krishak Unnati Yojana amount is overdue. The release date has passed and the amount has not been credited.",
            "correction": "Generate grievance; follow up after 15 days.",
            "documents": "Procurement receipt",
            "authority": "District Procurement Officer",
        },
    },
    "INTEREST_OR_PREMIUM_OVERCHARGED": {
        "trust": "Rule",
        "department": "Bank",
        "hi": {
            "display_text": "ब्याज दर या प्रीमियम नियम से अधिक लगाया गया है।",
            "speech_text": "आपसे नियम से अधिक ब्याज या प्रीमियम लिया गया है।",
            "correction": "गणना रसीद शाखा में दिखाएँ; 30 दिन बाद आरबीआई लोकपाल में शिकायत करें। पीएमएफबीवाई प्रीमियम के लिए 14447 पर कॉल करें।",
            "documents": "गणना रसीद, ऋण विवरण",
            "authority": "बैंक नोडल अधिकारी; आरबीआई; बीमाकर्ता; ज़िला समिति",
        },
        "en": {
            "display_text": "Interest rate or premium charged above the rule.",
            "speech_text": "You have been charged interest or premium above the entitled rate.",
            "correction": "Show math receipt at the branch; escalate after 30 days (RBI Ombudsman for loans); PMFBY premium via 14447 or the district committee.",
            "documents": "Math receipt, loan statement",
            "authority": "Bank nodal officer, RBI; insurer, district committee",
        },
    },
    "QTY_OVER_CAP": {
        "trust": "Rule",
        "department": "Procurement",
        "hi": {
            "display_text": "बेची गई मात्रा सीमा से अधिक है।",
            "speech_text": "आपने सीमा से अधिक धान बेचा है। अतिरिक्त मात्रा पर एमएसपी नहीं मिलेगा।",
            "correction": "अतिरिक्त मात्रा अन्यत्र बेचें।",
            "documents": "",
            "authority": "प्रापण समिति",
        },
        "en": {
            "display_text": "Quantity sold exceeds the cap.",
            "speech_text": "The quantity sold exceeds the per-acre cap. MSP will not apply to the excess.",
            "correction": "Sell the excess elsewhere.",
            "documents": "",
            "authority": "Procurement society",
        },
    },
    "MOISTURE_HIGH": {
        "trust": "Rule",
        "department": "Procurement",
        "hi": {
            "display_text": "नमी 17% से अधिक है।",
            "speech_text": "धान की नमी सत्रह प्रतिशत से अधिक है। पूर्ण एमएसपी की गारंटी नहीं है।",
            "correction": "धान सुखाकर वापस लाएँ।",
            "documents": "",
            "authority": "प्रापण समिति",
        },
        "en": {
            "display_text": "Moisture above 17%.",
            "speech_text": "The paddy moisture is above seventeen percent. Full MSP is not guaranteed.",
            "correction": "Dry the paddy and return.",
            "documents": "",
            "authority": "Procurement society",
        },
    },
    "PMFBY_NO_SHORTFALL": {
        "trust": "Rule",
        "department": "Insurance",
        "hi": {
            "display_text": "फसल कटाई प्रयोग (सीसीई) उपज सीमा से कम नहीं है, इसलिए दावा शून्य है।",
            "speech_text": "फसल कटाई प्रयोग की उपज सीमा से ऊपर है। बीमा दावा शून्य रुपये है।",
            "correction": "यूनिट डेटा जाँचें; स्थानीय आपदा दावा पात्र और समयबद्ध हो तो दाखिल करें।",
            "documents": "",
            "authority": "बीमाकर्ता; ज़िला समिति",
        },
        "en": {
            "display_text": "CCE yield is not below threshold, so the formula gives ₹0.",
            "speech_text": "The crop cutting experiment yield is above the threshold. The insurance claim is zero rupees.",
            "correction": "Check unit data; file a localized-calamity claim if eligible and in time.",
            "documents": "",
            "authority": "Insurer; district committee",
        },
    },
    "EXTERNAL_REJECTION_REPORTED": {
        "trust": "Farmer-reported",
        "department": "Various",
        "hi": {
            "display_text": "किसान द्वारा बताया गया अस्वीकृति कारण।",
            "speech_text": "यह कारण आपने बताया है। हम इसकी नियमों से जाँच करेंगे।",
            "correction": "WRONGFUL: शिकायत पत्र बनाएँ। CANNOT_VERIFY: संस्था से लिखित कारण माँगें।",
            "documents": "अस्वीकृति पत्र (यदि उपलब्ध)",
            "authority": "संबंधित श्रेणी के अनुसार",
        },
        "en": {
            "display_text": "Reason chosen by the farmer.",
            "speech_text": "This is the reason you reported. We will check it against the rules.",
            "correction": "WRONGFUL: generate grievance. CANNOT_VERIFY: ask the institution for a written reason.",
            "documents": "Rejection letter (if available)",
            "authority": "As per category",
        },
    },
    "REASON_UNAVAILABLE": {
        "trust": "Unavailable",
        "department": "Unknown",
        "hi": {
            "display_text": "कोई आधिकारिक कारण उपलब्ध नहीं है।",
            "speech_text": "अस्वीकृति का कोई आधिकारिक कारण उपलब्ध नहीं है।",
            "correction": "संस्था से लिखित कारण माँगें; मना करने पर शिकायत दर्ज करें।",
            "documents": "",
            "authority": "संबंधित श्रेणी के अनुसार",
        },
        "en": {
            "display_text": "No official reason in the data.",
            "speech_text": "No official reason for the rejection is available in the data.",
            "correction": "Ask the institution for the reason in writing; use the grievance ladder if refused.",
            "documents": "",
            "authority": "As per category",
        },
    },
}

ExternalVerdict = Literal["WRONGFUL", "CANNOT_VERIFY"]


def evaluate_external_rejection(
    reason_chip: str,
    loan: LoanInfo | None = None,
    insurance_unit: InsuranceUnitInfo | None = None,
) -> ExternalVerdict:
    """Evaluate a farmer-reported rejection reason against the rules.

    Returns WRONGFUL if a rule contradicts it, or CANNOT_VERIFY otherwise.
    """
    # Check known contradictions
    if reason_chip == "collateral_demanded" and loan is not None:
        collateral_free = get_rule_value("COLLATERAL_FREE_LIMIT")
        if loan.principal_paise <= collateral_free:
            return "WRONGFUL"

    if reason_chip == "insurance_claim_rejected" and insurance_unit is not None:
        if insurance_unit.cce_yield is not None:
            indemnity = insurance_unit.indemnity_level
            threshold = quantize_2dp(insurance_unit.average_yield * indemnity)
            if insurance_unit.cce_yield < threshold:
                return "WRONGFUL"

    if reason_chip == "over_cap_rejected" and loan is not None:
        cap = get_rule_value("OPERATIONAL_LOAN_CAP")
        if loan.principal_paise <= cap:
            return "WRONGFUL"

    return "CANNOT_VERIFY"


# ── Next-Best-Action Engine (FA10) ──────────────────────────────────

NextAction = Literal[
    "WAIT", "GENERATE_GRIEVANCE", "SHOW_RECEIPT_AT_BRANCH",
    "CORRECT_LAND_RECORD", "DRY_AND_RETURN", "CALL_HELPLINE",
    "REPORT_WITHIN_72_HOURS",
]


def next_best_action(
    state: DiscrepancyState,
    scheme: str,
    reason_code: str | None = None,
) -> NextAction:
    """Return the single primary action for a given discrepancy state."""
    if state == "PENDING":
        return "WAIT"
    if state == "REJECTED":
        if reason_code == "MOISTURE_HIGH":
            return "DRY_AND_RETURN"
        if reason_code in ("IDENTITY_FATHER_MISMATCH", "KHASRA_NOT_FOUND"):
            return "CORRECT_LAND_RECORD"
        return "GENERATE_GRIEVANCE"
    if state in ("OVERDUE", "UNDERPAID"):
        return "GENERATE_GRIEVANCE"
    if state == "OVERCHARGED":
        return "SHOW_RECEIPT_AT_BRANCH"
    if state == "DUE":
        return "WAIT"
    return "WAIT"


# ── Small-Cell Suppression (PL2) ────────────────────────────────────

def suppress_small_cells(
    data: list[dict],
    count_key: str = "count",
) -> list[dict]:
    """Replace cells with count < threshold with suppression text."""
    threshold = get_rule_value("SMALL_CELL_THRESHOLD")
    result = []
    for row in data:
        if row[count_key] < threshold:
            suppressed = dict(row)
            suppressed[count_key] = None
            suppressed["suppressed"] = True
            suppressed["suppression_text"] = "Under 5 (Suppressed for Privacy)"
            result.append(suppressed)
        else:
            row_copy = dict(row)
            row_copy["suppressed"] = False
            result.append(row_copy)
    return result


# ── Bank Verification (BK5, BK6) ───────────────────────────────────

def check_duplicate_kcc(
    farm_id: str,
    existing_loans: list[LoanInfo],
) -> bool:
    """Check if there's already an active subsidised KCC on this parcel.
    Returns True if duplicate found (MISS violation).
    """
    for loan in existing_loans:
        if (loan.farm_id == farm_id and loan.is_kcc and
                loan.is_active and loan.is_subsidised):
            return True
    return False


def check_over_financing(
    acres: Decimal,
    ownership_share: Decimal,
    requested_paise: int,
    existing_exposure_paise: int,
) -> tuple[bool, int]:
    """Check if requested amount exceeds the scale-of-finance limit.

    Returns (over_limit, max_allowed_paise).
    """
    sof_per_acre = get_rule_value("SCALE_OF_FINANCE_PER_ACRE")
    max_paise = int(
        (Decimal(sof_per_acre) * acres * ownership_share)
        .to_integral_value(rounding=ROUND_HALF_UP)
    )
    total_exposure = existing_exposure_paise + requested_paise
    return total_exposure > max_paise, max_paise


# ── Unified RulesEngine Interface & Input Schemas ─────────────────────

from enum import Enum


class DiscrepancyState(str, Enum):
    PENDING = "PENDING"
    DUE = "DUE"
    OVERDUE = "OVERDUE"
    PAID = "PAID"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    UNDERPAID = "UNDERPAID"
    OVERCHARGED = "OVERCHARGED"
    REJECTED = "REJECTED"


class RejectionVerdict(str, Enum):
    WRONGFUL = "WRONGFUL"
    CANNOT_VERIFY = "CANNOT_VERIFY"
    VERIFIED_CORRECT = "VERIFIED_CORRECT"


@dataclass
class KCCLoanInput:
    lender_type: str  # "PACS" | "COMMERCIAL" | "RRB"
    sanctioned_amount_paise: int
    disbursement_date: date
    due_date: date
    actual_repayment_date: date | None = None
    is_repaid_timely: bool = True
    interest_charged_paise: int = 0
    duration_months: int = 12


@dataclass
class PaddyProcurementInput:
    girdawari_paddy_hectares: Decimal
    paddy_grade: str = "COMMON"  # "COMMON" | "GRADE_A"
    moisture_pct: Decimal = Decimal("15.0")
    quantity_offered_quintals: Decimal = Decimal("0.0")


@dataclass
class PMFBYInput:
    crop_type: str  # "KHARIF_FOOD_OILSEEDS" | "RABI_FOOD_OILSEEDS" | "COMMERCIAL_HORTICULTURE"
    sum_insured_paise: int
    threshold_yield_kg_per_ha: Decimal
    actual_cce_yield_kg_per_ha: Decimal | None = None
    cutoff_date: date = date(2025, 12, 31)


@dataclass
class EntitlementDiscrepancyInput:
    scheme_id: str
    entitled_amount_paise: int
    actual_paid_amount_paise: int
    scheduled_date: date | None = None
    actual_payout_date: date | None = None
    reference_date: date | None = None
    is_rejected: bool = False


@dataclass
class OutsideRejectionInput:
    farmer_selected_reason_code: str
    actual_data: dict[str, Any] = field(default_factory=dict)


@dataclass
class BankAuditRecord:
    actor: str
    action: str
    payload: dict[str, Any]
    prev_hash: str | None = None


class RulesEngine:
    """Zero-AI Deterministic Rules Engine wrapping all statutory agricultural rules."""

    def __init__(self) -> None:
        self.rules = load_rules()

    def get_reason_catalog(self) -> dict[str, Any]:
        return REASON_CODES

    def calculate_kcc_loan(self, inp: KCCLoanInput) -> dict[str, Any]:
        operational_cap = 30000000  # ₹3,00,000 in paise
        lender = inp.lender_type.upper()

        if lender in ("PACS", "COOPERATIVE"):
            base_rate = Decimal("0.0")
            subvention = Decimal("0.0")
            effective_rate = Decimal("0.0") if inp.is_repaid_timely else Decimal("7.0")
        else:
            base_rate = Decimal("7.0")
            subvention = Decimal("3.0") if inp.is_repaid_timely else Decimal("0.0")
            effective_rate = base_rate - subvention

        # Cap handling
        if inp.sanctioned_amount_paise > operational_cap:
            eligible_subvention_paise = operational_cap
            excess_paise = inp.sanctioned_amount_paise - operational_cap
            cap_note = "Operational cap is ₹3,00,000 (announced ₹5,00,000 pending operationalization)"
        else:
            eligible_subvention_paise = inp.sanctioned_amount_paise
            excess_paise = 0
            cap_note = "Within ₹3,00,000 limit"

        # Interest calculation (simple interest, annual)
        duration_factor = Decimal(inp.duration_months) / Decimal(12)
        interest_rupees = (
            (Decimal(inp.sanctioned_amount_paise) / Decimal(100))
            * (effective_rate / Decimal(100))
            * duration_factor
        )
        interest_paise = int((interest_rupees * Decimal(100)).to_integral_value(rounding=ROUND_HALF_UP))

        return {
            "lender_type": lender,
            "base_interest_rate_pct": base_rate,
            "subvention_pct": subvention,
            "effective_interest_rate_pct": effective_rate,
            "interest_amount_paise": interest_paise,
            "is_timely": inp.is_repaid_timely,
            "cap_note": cap_note,
            "eligible_subvention_amount_paise": eligible_subvention_paise,
            "excess_amount_paise": excess_paise,
        }

    def calculate_paddy_procurement(self, inp: PaddyProcurementInput) -> dict[str, Any]:
        raw_acres = ha_to_acres(inp.girdawari_paddy_hectares)
        paddy_acres = quantize_2dp(raw_acres)
        cap_qtl = paddy_quantity_cap(paddy_acres, cap_per_acre=21)

        offered = quantize_2dp(inp.quantity_offered_quintals)
        eligible_qty = min(offered, cap_qtl)
        excess_qty = max(Decimal("0.00"), offered - cap_qtl)

        msp_rate = 2461 if inp.paddy_grade.upper() in ("GRADE_A", "GRADE A") else 2441
        kuy_rate = 659

        msp_amount_paise = int((eligible_qty * Decimal(msp_rate) * Decimal(100)).to_integral_value(rounding=ROUND_HALF_UP))
        kuy_amount_paise = int((eligible_qty * Decimal(kuy_rate) * Decimal(100)).to_integral_value(rounding=ROUND_HALF_UP))
        total_paise = msp_amount_paise + kuy_amount_paise

        # Moisture handling
        moisture = inp.moisture_pct
        if moisture > Decimal("18.0"):
            moisture_alert = True
            moisture_status = "ALERT"
            moisture_severity = "RED"
        elif moisture > Decimal("17.0"):
            moisture_alert = True
            moisture_status = "ALERT"
            moisture_severity = "AMBER"
        else:
            moisture_alert = False
            moisture_status = "ACCEPTABLE"
            moisture_severity = None

        return {
            "paddy_acres": paddy_acres,
            "eligible_cap_quintals": cap_qtl,
            "quantity_offered_quintals": offered,
            "procurement_quantity_quintals": eligible_qty,
            "excess_quintals": excess_qty,
            "msp_amount_paise": msp_amount_paise,
            "kuy_amount_paise": kuy_amount_paise,
            "total_entitlement_paise": total_paise,
            "moisture_alert": moisture_alert,
            "moisture_status": moisture_status,
            "moisture_severity": moisture_severity,
        }

    def calculate_pmfby(self, inp: PMFBYInput, today: date | None = None) -> dict[str, Any]:
        crop = inp.crop_type.upper()
        if "KHARIF" in crop:
            premium_rate = Decimal("2.0")
        elif "RABI" in crop:
            premium_rate = Decimal("1.5")
        else:
            premium_rate = Decimal("5.0")

        premium_paise = int(
            (Decimal(inp.sum_insured_paise) * (premium_rate / Decimal(100)))
            .to_integral_value(rounding=ROUND_HALF_UP)
        )

        threshold = quantize_2dp(inp.threshold_yield_kg_per_ha)
        cce = inp.actual_cce_yield_kg_per_ha

        if cce is not None and cce < threshold:
            shortfall = threshold - cce
            ratio = shortfall / threshold
            claim_paise = int(
                (Decimal(inp.sum_insured_paise) * ratio)
                .to_integral_value(rounding=ROUND_HALF_UP)
            )
            has_claim = True
            claim_pct = quantize_2dp(ratio * Decimal(100))
        else:
            claim_paise = 0
            has_claim = False
            claim_pct = Decimal("0.0000")

        return {
            "farmer_premium_rate_pct": premium_rate,
            "farmer_premium_paise": premium_paise,
            "threshold_yield_kg": threshold,
            "cce_yield_kg": cce,
            "has_claim": has_claim,
            "claim_rate_pct": claim_pct,
            "claim_amount_paise": claim_paise,
        }

    def detect_discrepancy(self, inp: EntitlementDiscrepancyInput) -> dict[str, Any]:
        ref_date = inp.reference_date or date.today()
        tolerance = 100  # 100 paise = ₹1

        if inp.is_rejected:
            return {
                "status": DiscrepancyState.REJECTED.value,
                "alert_flag": True,
                "days_overdue": 0,
            }

        if inp.actual_paid_amount_paise == 0:
            if inp.scheduled_date is None:
                status = DiscrepancyState.DUE.value
                days_overdue = 0
            elif ref_date < inp.scheduled_date:
                status = DiscrepancyState.PENDING.value
                days_overdue = 0
            elif ref_date == inp.scheduled_date:
                status = DiscrepancyState.DUE.value
                days_overdue = 0
            else:
                status = DiscrepancyState.OVERDUE.value
                days_overdue = (ref_date - inp.scheduled_date).days
            alert = status in (DiscrepancyState.OVERDUE.value, DiscrepancyState.REJECTED.value)
            return {"status": status, "alert_flag": alert, "days_overdue": days_overdue}

        diff = inp.entitled_amount_paise - inp.actual_paid_amount_paise
        if abs(diff) <= tolerance:
            return {"status": DiscrepancyState.PAID.value, "alert_flag": False, "days_overdue": 0}
        elif diff > tolerance:
            return {"status": DiscrepancyState.UNDERPAID.value, "alert_flag": True, "days_overdue": 0}
        else:
            return {"status": DiscrepancyState.OVERCHARGED.value, "alert_flag": True, "days_overdue": 0}

    def explain_outside_rejection(self, inp: OutsideRejectionInput) -> dict[str, Any]:
        code = inp.farmer_selected_reason_code
        data = inp.actual_data

        if code == "REJ_PADDY_EXCESS_QUANTITY":
            if "paddy_acres" in data and "quantity_offered_quintals" in data:
                cap = paddy_quantity_cap(data["paddy_acres"], 21)
                if data["quantity_offered_quintals"] <= cap:
                    return {
                        "verdict": RejectionVerdict.WRONGFUL.value,
                        "explanation": f"Quantity {data['quantity_offered_quintals']} qtl is within cap {cap} qtl.",
                    }
                else:
                    return {
                        "verdict": RejectionVerdict.VERIFIED_CORRECT.value,
                        "explanation": f"Quantity {data['quantity_offered_quintals']} qtl exceeds cap {cap} qtl.",
                    }
        elif code == "REJ_PADDY_MOISTURE_EXCEEDED":
            if "moisture_pct" not in data:
                return {
                    "verdict": RejectionVerdict.CANNOT_VERIFY.value,
                    "explanation": "No moisture reading found in registry.",
                }

        return {
            "verdict": RejectionVerdict.CANNOT_VERIFY.value,
            "explanation": "Cannot verify without authoritative data.",
        }

    def check_duplicate_kcc(self, parcel_id: str, active_loans: list[dict[str, Any]]) -> dict[str, Any]:
        for loan in active_loans:
            if loan.get("parcel_id") == parcel_id and loan.get("is_active", True):
                return {
                    "is_duplicate": True,
                    "existing_bank": loan.get("bank_name", "Unknown Bank"),
                }
        return {"is_duplicate": False, "existing_bank": None}

    def suppress_small_cell(self, count: int) -> dict[str, Any]:
        threshold = 5
        if count < threshold:
            return {"suppressed": True, "display": "Under 5 (Suppressed for Privacy)"}
        return {"suppressed": False, "display": str(count)}

    def evaluate_farmer_schemes(
        self,
        farmer_data: dict[str, Any],
        parcels: list[dict[str, Any]],
        loans: list[dict[str, Any]],
        procurements: list[dict[str, Any]],
        insurance_units: list[dict[str, Any]],
        answers: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Evaluate farmer eligibility across 5 statutory agricultural schemes purely using rules_2026.json."""
        ans = answers or {}
        has_land = len(parcels) > 0
        total_ha = sum(Decimal(str(p.get("area_ha", "0.0"))) for p in parcels)
        total_acres = quantize_2dp(ha_to_acres(total_ha)) if total_ha > 0 else Decimal("0.0")

        has_paddy_girdawari = any(
            p.get("girdawari_crop", "").lower() in ("paddy", "धान") for p in parcels
        )

        schemes: list[dict[str, Any]] = []

        # ── 1. KCC Interest Subvention Scheme ──────────────────────────────
        repaid_12m = ans.get("kcc_repaid_within_12m", True)
        if isinstance(repaid_12m, str):
            repaid_12m = repaid_12m.lower() in ("true", "1", "yes")

        kcc_eligible = has_land and repaid_12m
        if kcc_eligible:
            kcc_verdict_hi = "आप 3% केंद्रीय + 4% राज्य ब्याज अनुदान के पात्र हैं (समय पर अदायगी पर शुद्ध 0% PACS अथवा 4% बैंक दर)।"
            kcc_verdict_en = "You are eligible for 3% Central + 4% State interest subvention (Net 0% PACS or 4% Commercial Bank rate on timely repayment)."
            kcc_reason_hi = "पंजीकृत भूमि धारक और 12 माह के भीतर ऋण अदायगी की शर्त पूर्ण है। ₹3,00,000 तक ऋण पर पूर्ण अनुदान मान्य है।"
            kcc_reason_en = "Landholding farmer with crop loan repaid within statutory 12-month window up to ₹3,00,000 operational cap."
        else:
            kcc_verdict_hi = "वर्तमान में 3% शीघ्र अदायगी ब्याज अनुदान के लिए अपात्र।"
            kcc_verdict_en = "Currently not eligible for 3% prompt repayment subvention."
            kcc_reason_hi = "12 महीने के बाद ऋण चुकाने पर 3% अतिरिक्त अनुदान देय नहीं होता; 7% सामान्य बैंक दर लागू होती है।"
            kcc_reason_en = "Prompt repayment subvention is denied if loan repayment exceeds 12 months. Base 7% rate applies."

        schemes.append({
            "scheme_id": "RULE_KCC_SUBVENTION",
            "scheme_name_hi": "किसान क्रेडिट कार्ड (KCC) ब्याज अनुदान योजना",
            "scheme_name_en": "KCC Prompt Repayment Interest Subvention",
            "category": "Credit & Interest Subvention",
            "is_eligible": kcc_eligible,
            "verdict_hi": kcc_verdict_hi,
            "verdict_en": kcc_verdict_en,
            "rule_reason_hi": kcc_reason_hi,
            "rule_reason_en": kcc_reason_en,
            "rule_id": "RULE_KCC_SUBVENTION",
            "provenance": "rules_2026.json • Nov 2026",
            "official_portal_url": "https://agricoop.nic.in/en/Programmes/credit",
            "explainer": {
                "what_it_gives_hi": "3% केंद्रीय ब्याज अनुदान + 4% छत्तीसगढ़ राज्य अनुदान। 1 वर्ष के भीतर अदायगी पर शुद्ध 0% ब्याज (PACS) या 4% (बैंक)।",
                "what_it_gives_en": "3% Central subvention + 4% Chhattisgarh state grant. Net 0% interest on prompt repayment with PACS or 4% with Commercial/RRBs.",
                "who_qualifies_hi": "सभी पंजीकृत किसान जिनके पास चालू फसल ऋण है और जो 12 महीने के भीतर ऋण चुकाते हैं।",
                "who_qualifies_en": "All landholding farmers with an active crop loan who repay within the 12-month statutory cycle.",
                "documents_needed_hi": ["खसरा बी-1 नकल", "केसीसी पासबुक", "आधार कार्ड", "गिरदावरी फसल प्रमाण"],
                "documents_needed_en": ["Khasra B-1 Record", "KCC Passbook", "Aadhaar Card", "Girdawari Crop Record"],
            },
            "questions": [
                {
                    "question_id": "kcc_repaid_within_12m",
                    "question_text_hi": "क्या आपने फसल ऋण 12 महीने के भीतर चुकाया है?",
                    "question_text_en": "Have you repaid your crop loan within 12 months?",
                    "input_type": "boolean",
                    "current_value": repaid_12m,
                }
            ],
        })

        # ── 2. Chhattisgarh Krishak Unnati Yojana (Paddy MSP) ───────────────
        moisture_ok = ans.get("kuy_moisture_ok", True)
        if isinstance(moisture_ok, str):
            moisture_ok = moisture_ok.lower() in ("true", "1", "yes")

        kuy_eligible = has_land and has_paddy_girdawari and moisture_ok
        if kuy_eligible:
            kuy_verdict_hi = "आप ₹3,100/क्विंटल धान उपार्जन एवं कृषक उन्नति योजना बोनस के पूर्ण पात्र हैं।"
            kuy_verdict_en = "You are fully eligible for ₹3,100/quintal paddy procurement and Krishak Unnati bonus."
            kuy_reason_hi = f"आपकी भूमि ({total_acres} एकड़) पर धान की गिरदावरी दर्ज है। अधिकतम 21 क्विंटल/एकड़ सीमा तक एमएसपी ₹2,441 + बोनस ₹659 सुनिश्चित है।"
            kuy_reason_en = f"Paddy Girdawari recorded on {total_acres} acres. Statutory entitlement up to 21 qtl/acre cap with ₹2,441 MSP + ₹659 state bonus."
        else:
            kuy_verdict_hi = "वर्तमान में कृषक उन्नति योजना उपार्जन हेतु अपात्र।"
            kuy_verdict_en = "Currently not eligible for Krishak Unnati procurement bonus."
            if not has_paddy_girdawari:
                kuy_reason_hi = "भुइयां गिरदावरी रिकॉर्ड में धान की फसल दर्ज नहीं है।"
                kuy_reason_en = "Paddy crop is not recorded in Digital Girdawari revenue records."
            else:
                kuy_reason_hi = "धान में नमी 17% से अधिक होने पर मंडी द्वारा तुलाई अस्वीकृत की जाती है।"
                kuy_reason_en = "Paddy moisture exceeding 17% limit causes procurement hold until dried."

        schemes.append({
            "scheme_id": "RULE_KUY_PADDY",
            "scheme_name_hi": "छत्तीसगढ़ कृषक उन्नति योजना (धान उपार्जन)",
            "scheme_name_en": "Chhattisgarh Krishak Unnati Yojana (Paddy)",
            "category": "Procurement & DBT Bonus",
            "is_eligible": kuy_eligible,
            "verdict_hi": kuy_verdict_hi,
            "verdict_en": kuy_verdict_en,
            "rule_reason_hi": kuy_reason_hi,
            "rule_reason_en": kuy_reason_en,
            "rule_id": "RULE_KUY_PADDY",
            "provenance": "rules_2026.json • Nov 2026",
            "official_portal_url": "https://kisan.cg.nic.in",
            "explainer": {
                "what_it_gives_hi": "कुल ₹3,100 प्रति क्विंटल (केंद्रीय एमएसपी + ₹659 राज्य बोनस) सीधे बैंक खाते में डीबीटी। 21 क्विंटल/एकड़ सीमा।",
                "what_it_gives_en": "Guaranteed ₹3,100 per quintal total payout (MSP + ₹659 state bonus) directly into bank account up to 21 qtl/acre.",
                "who_qualifies_hi": "छत्तीसगढ़ के वे सभी पंजीकृत किसान जिनके खसरे पर खरीफ में धान की गिरदावरी दर्ज है।",
                "who_qualifies_en": "All registered Chhattisgarh farmers with verified Kharif paddy Girdawari on their land parcels.",
                "documents_needed_hi": ["किसान उपार्जन टोकन", "खसरा बी-1 पर्चा", "आधार-लिंक बैंक खाता", "गिरदावरी पावती"],
                "documents_needed_en": ["Mandi Token", "Khasra B-1 Form", "Aadhaar-Linked Bank Account", "Girdawari Receipt"],
            },
            "questions": [
                {
                    "question_id": "kuy_moisture_ok",
                    "question_text_hi": "क्या धान की नमी 17% या उससे कम है?",
                    "question_text_en": "Is paddy moisture 17% or less?",
                    "input_type": "boolean",
                    "current_value": moisture_ok,
                }
            ],
        })

        # ── 3. PMFBY Crop Insurance Scheme ─────────────────────────────────
        calamity_72h = ans.get("pmfby_calamity_72h", True)
        if isinstance(calamity_72h, str):
            calamity_72h = calamity_72h.lower() in ("true", "1", "yes")

        pmfby_eligible = has_land and calamity_72h
        if pmfby_eligible:
            pmfby_verdict_hi = "आप मात्र 2% खरीफ प्रीमियम पर प्रधानमंत्री फसल बीमा योजना के पूर्ण पात्र हैं।"
            pmfby_verdict_en = "You are eligible for PMFBY crop insurance at 2% statutory Kharif premium cap."
            pmfby_reason_hi = "अधिसूचित ग्राम में अधिसूचित फसल हेतु बीमा आवरण। ओलावृष्टि अथवा जलभराव पर 72 घंटे में सूचना पर त्वरित दावा मान्य।"
            pmfby_reason_en = "Covered under notified crop in insurance unit. Localized calamity claims valid when intimated within 72 hours."
        else:
            pmfby_verdict_hi = "स्थानीय आपदा दावे के लिए अपात्र।"
            pmfby_verdict_en = "Ineligible for localized calamity claim."
            pmfby_reason_hi = "स्थानीय आपदा की सूचना 72 घंटे की अनिवार्य समय-सीमा के बाद देने पर क्लेम अमान्य हो जाता है।"
            pmfby_reason_en = "Calamity intimation exceeded statutory 72-hour cutoff window."

        schemes.append({
            "scheme_id": "RULE_PMFBY_CLAIM",
            "scheme_name_hi": "प्रधानमंत्री फसल बीमा योजना (PMFBY)",
            "scheme_name_en": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
            "category": "Crop Risk & Calamity Insurance",
            "is_eligible": pmfby_eligible,
            "verdict_hi": pmfby_verdict_hi,
            "verdict_en": pmfby_verdict_en,
            "rule_reason_hi": pmfby_reason_hi,
            "rule_reason_en": pmfby_reason_en,
            "rule_id": "RULE_PMFBY_CLAIM",
            "provenance": "rules_2026.json • Nov 2026",
            "official_portal_url": "https://pmfby.gov.in",
            "explainer": {
                "what_it_gives_hi": "सूखा, बाढ़, ओलावृष्टि एवं कीट प्रकोप से फसल क्षति पर बीमित राशि का शत-प्रतिशत दावा। किसान प्रीमियम केवल 2% खरीफ / 1.5% रबी।",
                "what_it_gives_en": "Comprehensive claim against drought, flood, hailstorm, or pests. Farmer premium strictly capped at 2% Kharif / 1.5% Rabi.",
                "who_qualifies_hi": "अधिसूचित क्षेत्र में अधिसूचित फसलें उगाने वाले सभी ऋणी एवं गैर-ऋणी किसान।",
                "who_qualifies_en": "All loanee and non-loanee farmers cultivating notified crops in notified insurance units.",
                "documents_needed_hi": ["भूमि स्वामित्व प्रमाण (खसरा)", "बुवाई स्व-घोषणा पत्र", "बैंक पासबुक प्रति", "आपदा फोटोग्राफ"],
                "documents_needed_en": ["Land Possession (Khasra)", "Sowing Declaration", "Bank Passbook Copy", "Damage Photos"],
            },
            "questions": [
                {
                    "question_id": "pmfby_calamity_72h",
                    "question_text_hi": "क्या आपदा की सूचना 72 घंटे के भीतर हेल्पलाइन 14447 पर दर्ज की गई?",
                    "question_text_en": "Was localized damage reported within 72 hours via 14447 helpline?",
                    "input_type": "boolean",
                    "current_value": calamity_72h,
                }
            ],
        })

        # ── 4. PM-KISAN Samman Nidhi ────────────────────────────────────────
        pays_it = ans.get("pmkisan_income_tax", False)
        if isinstance(pays_it, str):
            pays_it = pays_it.lower() in ("true", "1", "yes")
        ekyc_done = ans.get("pmkisan_ekyc_done", True)
        if isinstance(ekyc_done, str):
            ekyc_done = ekyc_done.lower() in ("true", "1", "yes")

        pmkisan_eligible = has_land and (not pays_it) and ekyc_done
        if pmkisan_eligible:
            pmk_verdict_hi = "आप ₹6,000 प्रति वर्ष (₹2,000 की 3 किस्तों में) प्रत्यक्ष आय सहायता के पूर्ण पात्र हैं।"
            pmk_verdict_en = "You are eligible for ₹6,000 annual direct income support in 3 equal installments of ₹2,000."
            pmk_reason_hi = "कृषि योग्य भूमि आपके नाम पर दर्ज है, परिवार में कोई आयकर दाता नहीं है एवं ई-केवाईसी पूर्ण है।"
            pmk_reason_en = "Cultivable land recorded in revenue records, no income-tax exclusions, and e-KYC active."
        else:
            pmk_verdict_hi = "वर्तमान में पीएम-किसान किस्त के लिए अपात्र।"
            pmk_verdict_en = "Currently ineligible for PM-KISAN installment."
            if pays_it:
                pmk_reason_hi = "आयकर दाता होने के कारण वैधानिक नियमों के तहत अपात्र।"
                pmk_reason_en = "Excluded under statutory guideline: Income-tax payer in family."
            else:
                pmk_reason_hi = "बैंक खाते में आधार ई-केवाईसी (e-KYC) लंबित होने के कारण किस्त रुकी हुई है।"
                pmk_reason_en = "Installment on hold due to pending Aadhaar e-KYC authentication."

        schemes.append({
            "scheme_id": "RULE_PM_KISAN",
            "scheme_name_hi": "प्रधानमंत्री किसान सम्मान निधि (PM-KISAN)",
            "scheme_name_en": "PM-KISAN Samman Nidhi",
            "category": "Direct Income Support",
            "is_eligible": pmkisan_eligible,
            "verdict_hi": pmk_verdict_hi,
            "verdict_en": pmk_verdict_en,
            "rule_reason_hi": pmk_reason_hi,
            "rule_reason_en": pmk_reason_en,
            "rule_id": "RULE_PM_KISAN",
            "provenance": "rules_2026.json • Nov 2026",
            "official_portal_url": "https://pmkisan.gov.in",
            "explainer": {
                "what_it_gives_hi": "प्रति वर्ष ₹6,000 की सुनिश्चित आय सहायता, प्रति 4 माह में ₹2,000 सीधे आधार-सीडेड बैंक खाते में।",
                "what_it_gives_en": "Guaranteed ₹6,000 annual direct income support deposited in 3 installments of ₹2,000 via DBT.",
                "who_qualifies_hi": "सभी भूमिधारक किसान परिवार जिनके नाम पर कृषि योग्य भूमि दर्ज है (आयकर दाता छोड़कर)।",
                "who_qualifies_en": "All landholding farmer families with cultivable land in revenue records (excluding income-tax payers).",
                "documents_needed_hi": ["खसरा बी-1 खतौनी", "आधार कार्ड (मोबाइल लिंक)", "बैंक खाता पासबुक", "ई-केवाईसी"],
                "documents_needed_en": ["Khasra B-1 Record", "Aadhaar Card (Mobile Linked)", "Bank Passbook", "Active e-KYC"],
            },
            "questions": [
                {
                    "question_id": "pmkisan_income_tax",
                    "question_text_hi": "क्या आपके परिवार का कोई सदस्य आयकर (Income Tax) दाता है?",
                    "question_text_en": "Does anyone in your family pay Income Tax?",
                    "input_type": "boolean",
                    "current_value": pays_it,
                },
                {
                    "question_id": "pmkisan_ekyc_done",
                    "question_text_hi": "क्या आपका आधार ई-केवाईसी (e-KYC) पूर्ण है?",
                    "question_text_en": "Is your Aadhaar e-KYC authentication completed?",
                    "input_type": "boolean",
                    "current_value": ekyc_done,
                }
            ],
        })

        # ── 5. Chhattisgarh Saur Sujala Yojana (Solar Pump Subsidy) ─────────
        has_water = ans.get("sujala_has_water", True)
        if isinstance(has_water, str):
            has_water = has_water.lower() in ("true", "1", "yes")
        has_grid = ans.get("sujala_has_grid", False)
        if isinstance(has_grid, str):
            has_grid = has_grid.lower() in ("true", "1", "yes")

        sujala_eligible = has_land and has_water and (not has_grid)
        if sujala_eligible:
            sujala_verdict_hi = "आप 85% से 95% सरकारी अनुदान पर 3HP / 5HP सौर सिंचाई पंप स्थापना के पात्र हैं।"
            sujala_verdict_en = "You are eligible for 85% to 95% state subsidy on a 3HP or 5HP solar irrigation pump."
            sujala_reason_hi = "खेत पर बोरवेल/जल स्रोत उपलब्ध है एवं विद्युत ग्रिड कनेक्शन न होने के कारण सर्वोच्च प्राथमिकता।"
            sujala_reason_en = "Verified water source on land and absence of electric pump grid connection qualifies for top priority."
        else:
            sujala_verdict_hi = "वर्तमान में सौर सुजला पंप सब्सिडी प्राथमिकता में अपात्र।"
            sujala_verdict_en = "Currently ineligible for Saur Sujala priority installation."
            if not has_water:
                sujala_reason_hi = "खेत में बोरवेल अथवा जल स्रोत की उपलब्धता अनिवार्य है।"
                sujala_reason_en = "An operational borewell or groundwater source is mandatory."
            else:
                sujala_reason_hi = "खेत पर पहले से विद्युत ग्रिड पंप कनेक्शन होने पर सौर पंप सब्सिडी प्राथमिकता नहीं दी जाती।"
                sujala_reason_en = "Farms with existing conventional grid electricity pumps have lower allocation priority."

        schemes.append({
            "scheme_id": "RULE_CG_SAUR_SUJALA",
            "scheme_name_hi": "छत्तीसगढ़ सौर सुजला योजना (क्रेडा सोलर पंप)",
            "scheme_name_en": "Chhattisgarh Saur Sujala Yojana (Solar Pump)",
            "category": "Solar Irrigation & Farm Energy",
            "is_eligible": sujala_eligible,
            "verdict_hi": sujala_verdict_hi,
            "verdict_en": sujala_verdict_en,
            "rule_reason_hi": sujala_reason_hi,
            "rule_reason_en": sujala_reason_en,
            "rule_id": "RULE_CG_SAUR_SUJALA",
            "provenance": "rules_2026.json • Nov 2026",
            "official_portal_url": "https://creda.cgstate.gov.in",
            "explainer": {
                "what_it_gives_hi": "3HP अथवा 5HP सोलर पंप मात्र ₹10,000 - ₹20,000 कृषक अंशदान पर (क्रेडा द्वारा पूर्ण स्थापना एवं 5 वर्ष वारंटी)।",
                "what_it_gives_en": "3HP or 5HP Solar irrigation pump at heavily subsidised farmer share (₹10,000 - ₹20,000) with 5-year warranty.",
                "who_qualifies_hi": "छत्तीसगढ़ के वे किसान जिनके खेत में बोरवेल/कुआं है और बिजली का स्थायी कृषि कनेक्शन नहीं है।",
                "who_qualifies_en": "Chhattisgarh farmers with established borewell/well lacking conventional agricultural grid power.",
                "documents_needed_hi": ["खसरा बी-1 नकल", "बोरवेल/जल स्रोत प्रमाण", "जाति प्रमाण पत्र (अजा/अजजा/अपिव)", "आधार कार्ड"],
                "documents_needed_en": ["Khasra B-1 Copy", "Water Source Proof", "Caste Certificate (if SC/ST/OBC)", "Aadhaar Card"],
            },
            "questions": [
                {
                    "question_id": "sujala_has_water",
                    "question_text_hi": "क्या आपके खेत में बोरवेल अथवा जल स्रोत उपलब्ध है?",
                    "question_text_en": "Do you have an operational borewell or water source on your land?",
                    "input_type": "boolean",
                    "current_value": has_water,
                },
                {
                    "question_id": "sujala_has_grid",
                    "question_text_hi": "क्या खेत पर पहले से बिजली ग्रिड कनेक्शन है?",
                    "question_text_en": "Do you already have a conventional electric grid connection on the farm?",
                    "input_type": "boolean",
                    "current_value": has_grid,
                }
            ],
        })

        eligible = [s for s in schemes if s["is_eligible"]]
        not_eligible = [s for s in schemes if not s["is_eligible"]]

        return {
            "eligible_schemes": eligible,
            "not_eligible_schemes": not_eligible,
            "total_evaluated": len(schemes),
            "rules_last_reviewed": "2026-11-23",
            "provenance": "Synthetic Demo Data • Rules Last Reviewed: Nov 2026",
        }




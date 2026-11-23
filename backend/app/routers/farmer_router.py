"""
Farmer router: Registry snapshot, Entitlement calculation, Discrepancies, Grievances.
Enforces Hard Rule 7: All endpoints derive farmer_id strictly from session.
"""
import json
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models.entities import (
    Farmer,
    LandParcel,
    Loan,
    Procurement,
    InsuranceUnit,
    Case,
    AuditEvent,
    BankApplication,
    Rejection,
    FarmerSchemeApplication,
)
from app.auth import get_current_farmer_id, get_current_farmer
from app.adapters.synthetic_adapter import SyntheticAdapter
from app.rules.engine import (
    RulesEngine,
    KCCLoanInput,
    PaddyProcurementInput,
    PMFBYInput,
    EntitlementDiscrepancyInput,
    OutsideRejectionInput,
    RejectionVerdict,
)
from app.rules.helpers import (
    ha_to_acres,
    paddy_quantity_cap,
    display_rupees,
    quantize_2dp,
)
from app.rules.number_words import rupees_to_hindi_words, rupees_to_english_words
from app.schemas.schemas import (
    FarmerSnapshotResponse,
    FarmerProfile,
    LandParcelSchema,
    LoanSchema,
    ProcurementSchema,
    InsuranceUnitSchema,
    DiscrepanciesResponse,
    DiscrepancyItem,
    OutsideRejectionRequest,
    OutsideRejectionResponse,
    CreateCaseRequest,
    CaseSchema,
    UpdateCaseStatusRequest,
    SchemeEvaluationRequest,
    InteractiveKCCRequest,
    InteractivePaddyRequest,
    InteractivePMFBYRequest,
    FarmerLoanApplyRequest,
    FarmerSchemeApplyRequest,
    FarmerAppliedSchemeItem,
    UpdateAppliedSchemeReceivedRequest,
    BankDecisionItem,
    FarmerLoansAndDecisionsResponse,
)
from app.services.audit_service import AuditChainService
from app.services.template_service import TemplateService

router = APIRouter(tags=["Farmer"])


@router.get("/snapshot", response_model=FarmerSnapshotResponse)
def get_snapshot(
    farmer: Farmer = Depends(get_current_farmer),
    db: Session = Depends(get_db),
):
    """Fetch unified registry snapshot: parcels, loans, procurements, insurance."""
    adapter = SyntheticAdapter(db)
    raw_snapshot = adapter.get_registry_snapshot(farmer.id)

    parcels_schema = []
    total_ha = Decimal("0.0000")
    total_acres = Decimal("0.00")

    for p in raw_snapshot["parcels"]:
        ha = Decimal(p["area_ha"])
        acres = quantize_2dp(ha_to_acres(ha))
        total_ha += ha
        total_acres += acres
        parcels_schema.append(
            LandParcelSchema(
                parcel_id=p["parcel_id"],
                district=p["district"],
                tehsil=p["tehsil"],
                village=p["village"],
                khasra_no=p["khasra_no"],
                area_ha=str(ha),
                area_acres=str(acres),
                girdawari_crop=p["girdawari_crop"],
                girdawari_ha=p["girdawari_ha"],
                mortgage_status=p["mortgage_status"],
                mortgage_bank=p["mortgage_bank"],
            )
        )

    loans_schema = [
        LoanSchema(
            loan_id=l["loan_id"],
            parcel_id=l["parcel_id"],
            lender_type=l["lender_type"],
            bank_name=l["bank_name"],
            principal_paise=l["principal_paise"],
            principal_display=display_rupees(l["principal_paise"]),
            interest_charged_paise=l["interest_charged_paise"],
            interest_charged_display=display_rupees(l["interest_charged_paise"]),
            disbursement_date=l["disbursement_date"],
            due_date=l["due_date"],
            actual_repayment_date=l["actual_repayment_date"],
            is_repaid_timely=l["is_repaid_timely"],
            is_kcc=l["is_kcc"],
            is_active=l["is_active"],
            is_subsidised=l["is_subsidised"],
        )
        for l in raw_snapshot["loans"]
    ]

    proc_schema = [
        ProcurementSchema(
            procurement_id=pr["procurement_id"],
            parcel_id=pr["parcel_id"],
            crop=pr["crop"],
            quantity_quintals=pr["quantity_quintals"],
            moisture_pct=pr["moisture_pct"],
            grade=pr["grade"],
            msp_paid_paise=pr["msp_paid_paise"],
            msp_paid_display=display_rupees(pr["msp_paid_paise"]),
            kuy_paid_paise=pr["kuy_paid_paise"],
            kuy_paid_display=display_rupees(pr["kuy_paid_paise"]),
            kuy_expected_release_date=pr["kuy_expected_release_date"],
            procurement_date=pr["procurement_date"],
            mandi_receipt_no=pr["mandi_receipt_no"],
        )
        for pr in raw_snapshot["procurements"]
    ]

    ins_schema = [
        InsuranceUnitSchema(
            unit_id=u["unit_id"],
            village_code=u["village_code"],
            parcel_id=u["parcel_id"],
            crop=u["crop"],
            season=u["season"],
            sum_insured_per_ha_paise=u["sum_insured_per_ha_paise"],
            average_yield_kg=u["average_yield_kg"],
            indemnity_level=u["indemnity_level"],
            cce_yield_kg=u["cce_yield_kg"],
            cutoff_date=u["cutoff_date"],
            insured_ha=u["insured_ha"],
        )
        for u in raw_snapshot["insurance_units"]
    ]

    return FarmerSnapshotResponse(
        farmer=FarmerProfile(
            id=farmer.id,
            mobile=farmer.mobile,
            masked_mobile=farmer.masked_mobile,
            name_hi=farmer.name_hi,
            name_en=farmer.name_en,
            father_name_hi=farmer.father_name_hi,
            father_name_en=farmer.father_name_en,
            village=farmer.village,
            tehsil=farmer.tehsil,
            district=farmer.district,
            consent_given=farmer.consent_given,
        ),
        parcels=parcels_schema,
        total_area_ha=str(total_ha),
        total_area_acres=str(total_acres),
        loans=loans_schema,
        procurements=proc_schema,
        insurance_units=ins_schema,
        provenance="Synthetic Demo Data",
        rules_last_verified="2026-03-01",
    )


@router.get("/discrepancies", response_model=DiscrepanciesResponse)
def get_discrepancies(
    farmer: Farmer = Depends(get_current_farmer),
    db: Session = Depends(get_db),
):
    """
    Compute entitlements vs actual received records.
    Produces 4-part explanation cards with locked bilingual templates.
    """
    engine = RulesEngine()
    adapter = SyntheticAdapter(db)
    snapshot = adapter.get_registry_snapshot(farmer.id)

    # Demo reference date set to March 19, 2026 (KUY is 18 days overdue)
    reference_date = date(2026, 3, 19)
    items: list[DiscrepancyItem] = []
    total_gap = 0

    # 1. Paddy MSP + KUY Calculations
    for pr in snapshot["procurements"]:
        if pr["crop"].lower() in ("paddy", "धान"):
            # Fetch parcel area
            parcel = next((p for p in snapshot["parcels"] if p["parcel_id"] == pr["parcel_id"]), None)
            ha = Decimal(parcel["area_ha"]) if parcel else Decimal("1.2140")
            qty_sold = Decimal(pr["quantity_quintals"])

            paddy_calc = engine.calculate_paddy_procurement(
                PaddyProcurementInput(
                    girdawari_paddy_hectares=ha,
                    paddy_grade=pr["grade"].upper(),
                    moisture_pct=Decimal(pr["moisture_pct"]),
                    quantity_offered_quintals=qty_sold,
                )
            )

            # Check KUY Discrepancy
            kuy_entitled = paddy_calc["kuy_amount_paise"]
            kuy_paid = pr["kuy_paid_paise"]
            expected_date = date.fromisoformat(pr["kuy_expected_release_date"]) if pr["kuy_expected_release_date"] else None

            kuy_disc = engine.detect_discrepancy(
                EntitlementDiscrepancyInput(
                    scheme_id="KUY_2026",
                    entitled_amount_paise=kuy_entitled,
                    actual_paid_amount_paise=kuy_paid,
                    scheduled_date=expected_date,
                    reference_date=reference_date,
                )
            )

            gap = max(0, kuy_entitled - kuy_paid)
            if gap > 0:
                total_gap += gap

            days_od = kuy_disc.get("days_overdue", 0)
            status_val = kuy_disc["status"]

            # Speech text with Indian number words
            gap_words_hi = rupees_to_hindi_words(gap)
            gap_words_en = rupees_to_english_words(gap)

            if status_val == "OVERDUE":
                explanation_hi = f"कृषक उन्नति योजना बोनस की देय राशि {display_rupees(kuy_entitled)} निर्धारित तारीख़ ({expected_date}) से {days_od} दिनों से लंबित है।"
                explanation_en = f"Krishak Unnati Yojana bonus of {display_rupees(kuy_entitled)} is overdue by {days_od} days past the scheduled release date ({expected_date})."
                speech_hi = f"कृषक उन्नति योजना बोनस की राशि {gap_words_hi} {days_od} दिनों से लंबित है।"
                speech_en = f"Krishak Unnati Yojana bonus of {gap_words_en} is overdue by {days_od} days."
                next_action = "GENERATE_GRIEVANCE"
            else:
                explanation_hi = "कृषक उन्नति योजना राशि प्रक्रियाधीन है।"
                explanation_en = "Krishak Unnati Yojana amount is being processed."
                speech_hi = "कृषक उन्नति योजना राशि प्रक्रियाधीन है।"
                speech_en = "Krishak Unnati Yojana bonus is currently under processing."
                next_action = "WAIT"

            items.append(
                DiscrepancyItem(
                    scheme_id="KUY_2026",
                    scheme_name_hi="कृषक उन्नति योजना (बोनस)",
                    scheme_name_en="Krishak Unnati Yojana (Bonus)",
                    parcel_id=pr["parcel_id"],
                    entitled_paise=kuy_entitled,
                    entitled_display=display_rupees(kuy_entitled),
                    received_paise=kuy_paid,
                    received_display=display_rupees(kuy_paid),
                    gap_paise=gap,
                    gap_display=display_rupees(gap),
                    status=status_val,
                    days_overdue=days_od,
                    alert_flag=kuy_disc["alert_flag"],
                    next_action=next_action,
                    explanation_hi=explanation_hi,
                    explanation_en=explanation_en,
                    speech_text_hi=speech_hi,
                    speech_text_en=speech_en,
                    rule_id="RULE_KUY_2026",
                )
            )

    # 2. Loan Overcharge Check
    for loan in snapshot["loans"]:
        loan_calc = engine.calculate_kcc_loan(
            KCCLoanInput(
                lender_type=loan["lender_type"],
                sanctioned_amount_paise=loan["principal_paise"],
                disbursement_date=date.fromisoformat(loan["disbursement_date"]),
                due_date=date.fromisoformat(loan["due_date"]),
                is_repaid_timely=loan["is_repaid_timely"],
            )
        )
        entitled_interest = loan_calc["interest_amount_paise"]
        charged_interest = loan["interest_charged_paise"]
        overcharge = max(0, charged_interest - entitled_interest)

        if overcharge > 100:  # > ₹1 tolerance
            total_gap += overcharge
            diff_words_hi = rupees_to_hindi_words(overcharge)
            diff_words_en = rupees_to_english_words(overcharge)

            items.append(
                DiscrepancyItem(
                    scheme_id="KCC_SUBVENTION",
                    scheme_name_hi="केसीसी ब्याज अनुदान (प्रॉम्प्ट रिपेमेंट)",
                    scheme_name_en="KCC Prompt Repayment Subvention",
                    parcel_id=loan["parcel_id"],
                    entitled_paise=entitled_interest,
                    entitled_display=display_rupees(entitled_interest),
                    received_paise=charged_interest,
                    received_display=display_rupees(charged_interest),
                    gap_paise=overcharge,
                    gap_display=display_rupees(overcharge),
                    status="OVERCHARGED",
                    days_overdue=0,
                    alert_flag=True,
                    next_action="SHOW_RECEIPT_AT_BRANCH",
                    explanation_hi=f"समय पर भुगतान के उपरांत 4% की जगह 7% ब्याज दर लगाया गया है। अधिक काटा गया ब्याज: {display_rupees(overcharge)}।",
                    explanation_en=f"Timely repayment entitled to 4% effective rate, but bank charged 7%. Overcharge: {display_rupees(overcharge)}.",
                    speech_text_hi=f"समय पर भुगतान के बावजूद बैंक द्वारा {diff_words_hi} अतिरिक्त ब्याज लगाया गया है।",
                    speech_text_en=f"Despite timely repayment, the bank overcharged interest of {diff_words_en}.",
                    rule_id="RULE_RRB_SUBVENTION",
                )
            )

    # 3. PMFBY Crop Loss Check
    for ins in snapshot["insurance_units"]:
        if ins["cce_yield_kg"] is not None:
            pmfby_calc = engine.calculate_pmfby(
                PMFBYInput(
                    crop_type="KHARIF_FOOD_OILSEEDS",
                    sum_insured_paise=ins["sum_insured_per_ha_paise"],
                    threshold_yield_kg_per_ha=Decimal(ins["average_yield_kg"]) * Decimal(ins["indemnity_level"]),
                    actual_cce_yield_kg_per_ha=Decimal(ins["cce_yield_kg"]),
                )
            )
            if pmfby_calc["has_claim"]:
                claim_paise = pmfby_calc["claim_amount_paise"]
                total_gap += claim_paise
                claim_words_hi = rupees_to_hindi_words(claim_paise)
                claim_words_en = rupees_to_english_words(claim_paise)

                items.append(
                    DiscrepancyItem(
                        scheme_id="PMFBY_CLAIM",
                        scheme_name_hi="प्रधानमंत्री फसल बीमा योजना (दावा)",
                        scheme_name_en="PMFBY Crop Insurance Claim",
                        parcel_id=ins["parcel_id"],
                        entitled_paise=claim_paise,
                        entitled_display=display_rupees(claim_paise),
                        received_paise=0,
                        received_display="₹0",
                        gap_paise=claim_paise,
                        gap_display=display_rupees(claim_paise),
                        status="UNDERPAID",
                        days_overdue=15,
                        alert_flag=True,
                        next_action="CALL_HELPLINE",
                        explanation_hi=f"सीसीई उपज में {pmfby_calc['claim_rate_pct']}% की गिरावट दर्ज हुई है। देय दावा: {display_rupees(claim_paise)}।",
                        explanation_en=f"CCE yield showed {pmfby_calc['claim_rate_pct']}% shortfall against threshold. Eligible claim: {display_rupees(claim_paise)}.",
                        speech_text_hi=f"फसल कटाई प्रयोग अनुसार आपका {claim_words_hi} का बीमा दावा लंबित है।",
                        speech_text_en=f"According to crop cutting yield data, your insurance claim of {claim_words_en} is pending.",
                        rule_id="RULE_PMFBY_CLAIM",
                    )
                )

    return DiscrepanciesResponse(
        discrepancies=items,
        total_gap_paise=total_gap,
        total_gap_display=display_rupees(total_gap),
        provenance="Synthetic Demo Data",
    )


@router.post("/schemes/evaluate")
def evaluate_schemes(
    req: SchemeEvaluationRequest = None,
    farmer: Farmer = Depends(get_current_farmer),
    db: Session = Depends(get_db),
):
    """Evaluate farmer eligibility across 5 statutory agricultural schemes."""
    adapter = SyntheticAdapter(db)
    raw_snapshot = adapter.get_registry_snapshot(farmer.id)
    answers = req.answers if req else {}

    engine = RulesEngine()
    result = engine.evaluate_farmer_schemes(
        farmer_data={"id": farmer.id, "name_hi": farmer.name_hi, "village": farmer.village},
        parcels=raw_snapshot.get("parcels", []),
        loans=raw_snapshot.get("loans", []),
        procurements=raw_snapshot.get("procurements", []),
        insurance_units=raw_snapshot.get("insurance_units", []),
        answers=answers,
    )
    return result


@router.post("/calculate-kcc")
def calculate_kcc_interactive(req: InteractiveKCCRequest):
    """Pure-Python interactive KCC subvention calculation."""
    from decimal import ROUND_HALF_UP
    lender = req.lender_type.upper()
    principal_rupees = Decimal(req.principal_paise) / Decimal(100)
    duration_factor = Decimal(req.duration_months) / Decimal(12)

    if lender in ("PACS", "COOPERATIVE"):
        base_rate = Decimal("0.0")
        subvention_rate = Decimal("0.0")
        effective_rate = Decimal("0.0") if (req.is_repaid_timely and req.duration_months <= 12) else Decimal("7.0")
        rule_id = "PACS_INTEREST_RATE_TIMELY"
        rule_desc_hi = "सहकारी समिति (PACS) द्वारा 1 वर्ष में चुकाने पर शुद्ध 0% ब्याज दर (राज्य + केंद्र अनुदान द्वारा वहन)।"
        rule_desc_en = "PACS prompt repayment within 1 year carries net 0% interest under statutory subvention."
    else:
        base_rate = Decimal("7.0")
        subvention_rate = Decimal("3.0") if (req.is_repaid_timely and req.duration_months <= 12) else Decimal("0.0")
        effective_rate = base_rate - subvention_rate
        rule_id = "RRB_SUBVENTION"
        rule_desc_hi = "वाणिज्यिक/क्षेत्रीय ग्रामीण बैंक द्वारा 7% आधार दर - 3% शीघ्र अदायगी अनुदान = शुद्ध 4% ब्याज दर।"
        rule_desc_en = "Commercial/RRB KCC: 7% Base Rate - 3% Prompt Repayment Subvention = 4% Net Rate."

    interest_rupees = (principal_rupees * (effective_rate / Decimal(100)) * duration_factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    entitled_interest_paise = int(interest_rupees * Decimal(100))

    actual_charged_paise = req.actual_interest_charged_paise if req.actual_interest_charged_paise is not None else entitled_interest_paise
    overcharge_paise = max(0, actual_charged_paise - entitled_interest_paise)

    # Collateral-free limit check (RBI ₹2,00,000 threshold)
    collateral_free = req.principal_paise <= 20000000

    rule_steps = [
        {
            "step": 1,
            "title_hi": "ऋणदाता वर्गीकरण एवं आधार दर",
            "title_en": "Lender Classification & Base Rate",
            "desc_hi": f"संस्था: {req.lender_type.upper()} | आधार ब्याज दर: {base_rate}%",
            "desc_en": f"Lender: {req.lender_type.upper()} | Statutory Base Rate: {base_rate}%",
        },
        {
            "step": 2,
            "title_hi": "3% शीघ्र अदायगी अनुदान पात्रता",
            "title_en": "3% Prompt Repayment Subvention Eligibility",
            "desc_hi": f"अदायगी अवधि: {req.duration_months} माह | अनुदान: {subvention_rate}% | प्रभावी दर: {effective_rate}%",
            "desc_en": f"Repayment Duration: {req.duration_months} months | Subvention: {subvention_rate}% | Effective Rate: {effective_rate}%",
        },
        {
            "step": 3,
            "title_hi": "₹2,00,000 बंधक-मुक्त (Collateral-Free) सीमा",
            "title_en": "₹2,00,000 Collateral-Free Limit Check",
            "desc_hi": "₹2 लाख तक के ऋण पर कोई भूमि बंधक अथवा गारंटी आवश्यक नहीं है।" if collateral_free else "₹2 लाख से अधिक ऋण पर बैंक द्वारा बंधक लिया जाना अनुमत है।",
            "desc_en": "Loans up to ₹2.00 Lakh require no land mortgage or collateral." if collateral_free else "Loans above ₹2.00 Lakh are subject to standard collateral rules.",
        },
        {
            "step": 4,
            "title_hi": "अंतिम ब्याज गणना सूत्र",
            "title_en": "Interest Calculation Formula",
            "desc_hi": f"देय ब्याज = ₹{int(principal_rupees):,} × {effective_rate}% × ({req.duration_months}/12) = ₹{int(interest_rupees):,}",
            "desc_en": f"Interest Owed = ₹{int(principal_rupees):,} × {effective_rate}% × ({req.duration_months}/12) = ₹{int(interest_rupees):,}",
        }
    ]

    return {
        "principal_paise": req.principal_paise,
        "principal_display": display_rupees(req.principal_paise),
        "lender_type": req.lender_type,
        "base_rate_pct": float(base_rate),
        "subvention_pct": float(subvention_rate),
        "effective_rate_pct": float(effective_rate),
        "duration_months": req.duration_months,
        "entitled_interest_paise": entitled_interest_paise,
        "entitled_display": display_rupees(entitled_interest_paise),
        "actual_interest_paise": actual_charged_paise,
        "actual_display": display_rupees(actual_charged_paise),
        "gap_paise": overcharge_paise,
        "gap_display": display_rupees(overcharge_paise),
        "is_overcharged": overcharge_paise > 0,
        "collateral_free": collateral_free,
        "rule_id": rule_id,
        "rule_desc_hi": rule_desc_hi,
        "rule_desc_en": rule_desc_en,
        "rule_steps": rule_steps,
        "rupees_in_words_hi": rupees_to_hindi_words(entitled_interest_paise),
        "rupees_in_words_en": rupees_to_english_words(entitled_interest_paise),
        "provenance": "rules_2026.json • Nov 2026",
    }


@router.post("/calculate-paddy")
def calculate_paddy_interactive(req: InteractivePaddyRequest):
    """Pure-Python interactive Paddy and General Crop MSP calculation."""
    from decimal import ROUND_HALF_UP
    acres = Decimal(str(req.acres))
    offered = Decimal(str(req.quantity_offered_quintals))

    crop = (getattr(req, "crop_type", "") or "PADDY_COMMON").upper()
    is_grade_a = req.grade.upper() in ("GRADE_A", "GRADE A") or crop == "PADDY_GRADE_A"

    # Crop parameters from official 2025-26 MSP standards
    if crop == "MAIZE":
        crop_name_hi = "मक्का (Maize)"
        crop_name_en = "Maize"
        msp_rate = 2218
        kuy_rate = 0
        cap_val = 25
        moisture_max = Decimal("14.0")
        moisture_reject = Decimal("18.0")
    elif crop == "TUR":
        crop_name_hi = "अरहर / तुअर (Tur / Arhar)"
        crop_name_en = "Tur / Arhar"
        msp_rate = 7150
        kuy_rate = 0
        cap_val = 10
        moisture_max = Decimal("12.0")
        moisture_reject = Decimal("16.0")
    elif crop == "RAGI":
        crop_name_hi = "रागी / मड़ुआ (Ragi)"
        crop_name_en = "Ragi"
        msp_rate = 4046
        kuy_rate = 0
        cap_val = 12
        moisture_max = Decimal("12.0")
        moisture_reject = Decimal("16.0")
    elif crop == "SOYBEAN":
        crop_name_hi = "सोयाबीन (Soybean)"
        crop_name_en = "Soybean"
        msp_rate = 4892
        kuy_rate = 0
        cap_val = 12
        moisture_max = Decimal("12.0")
        moisture_reject = Decimal("16.0")
    elif crop == "KODO_KUTKI":
        crop_name_hi = "कोदो-कुटकी (Kodo-Kutki)"
        crop_name_en = "Kodo-Kutki"
        msp_rate = 3200
        kuy_rate = 0
        cap_val = 10
        moisture_max = Decimal("12.0")
        moisture_reject = Decimal("16.0")
    else:  # PADDY_COMMON or PADDY_GRADE_A
        crop_name_hi = f"धान ({'ग्रेड-ए' if is_grade_a else 'सामान्य'})"
        crop_name_en = f"Paddy ({'Grade A' if is_grade_a else 'Common'})"
        msp_rate = 2461 if is_grade_a else 2441
        kuy_rate = 659
        cap_val = 21
        moisture_max = Decimal("17.0")
        moisture_reject = Decimal("20.0")

    cap_qtl = paddy_quantity_cap(acres, cap_val)
    eligible_qty = min(offered, cap_qtl)
    excess_qty = max(Decimal("0.0"), offered - cap_qtl)
    total_rate = msp_rate + kuy_rate

    msp_gross_paise = int((eligible_qty * Decimal(msp_rate) * Decimal(100)).to_integral_value(rounding=ROUND_HALF_UP))
    kuy_gross_paise = int((eligible_qty * Decimal(kuy_rate) * Decimal(100)).to_integral_value(rounding=ROUND_HALF_UP))
    total_gross_paise = msp_gross_paise + kuy_gross_paise

    moisture = Decimal(str(req.moisture_pct))
    is_rejected = False
    moisture_deduction_paise = 0
    moisture_status = "ACCEPTABLE"
    excess_m = Decimal("0.0")

    if moisture > moisture_reject:
        is_rejected = True
        moisture_status = "REJECTED"
        net_payout_paise = 0
    elif moisture > moisture_max:
        moisture_status = "ALERT"
        excess_m = moisture - moisture_max
        deduction_pct = excess_m * Decimal("0.015")
        moisture_deduction_paise = int((Decimal(total_gross_paise) * deduction_pct).to_integral_value(rounding=ROUND_HALF_UP))
        net_payout_paise = max(0, total_gross_paise - moisture_deduction_paise)
    else:
        net_payout_paise = total_gross_paise

    actual_received = req.actual_received_paise if req.actual_received_paise is not None else net_payout_paise
    gap_paise = max(0, net_payout_paise - actual_received)

    rule_steps = [
        {
            "step": 1,
            "title_hi": f"वैधानिक उपार्जन सीमा ({cap_val} क्विंटल/एकड़)",
            "title_en": f"Statutory Quantity Cap ({cap_val} qtl/acre)",
            "desc_hi": f"{acres} एकड़ × {cap_val} क्विंटल = {cap_qtl} क्विंटल मान्य उपार्जन सीमा (अतिरिक्त: {excess_qty} क्विंटल)",
            "desc_en": f"{acres} acres × {cap_val} qtl/acre = {cap_qtl} qtl statutory cap (Excess: {excess_qty} qtl)",
        },
        {
            "step": 2,
            "title_hi": "केंद्रीय एमएसपी एवं कृषक उन्नति बोनस दर",
            "title_en": "Central MSP + KUY Bonus Rates",
            "desc_hi": f"केंद्रीय एमएसपी ({crop_name_hi}): ₹{msp_rate}" + (f" + राज्य बोनस: ₹{kuy_rate}" if kuy_rate > 0 else "") + f" = कुल ₹{total_rate}/क्विंटल",
            "desc_en": f"Central MSP ({crop_name_en}): ₹{msp_rate}" + (f" + CG Bonus: ₹{kuy_rate}" if kuy_rate > 0 else "") + f" = Total ₹{total_rate}/qtl",
        },
        {
            "step": 3,
            "title_hi": f"नमी मानक ({moisture_max}% सीमा)",
            "title_en": f"Moisture Norms ({moisture_max}% Threshold)",
            "desc_hi": f"मापी गई नमी: {moisture}% - " + (
                "स्वीकार्य मानक के भीतर (पूर्ण भुगतान)" if moisture <= moisture_max else
                f"{moisture_max}% से अधिक ({excess_m}%), कटौती दर 1.5%/प्रतिशत = -{display_rupees(moisture_deduction_paise)}" if moisture <= moisture_reject else
                f"{moisture_reject}% से अधिक! मंडी नियमों अनुसार सुखाकर पुनः लाना अनिवार्य।"
            ),
            "desc_en": f"Measured moisture: {moisture}% - " + (
                "Within acceptable statutory limit (Full Payout)" if moisture <= moisture_max else
                f"Above {moisture_max}% ({excess_m}%), driage cut @ 1.5%/pct = -{display_rupees(moisture_deduction_paise)}" if moisture <= moisture_reject else
                f"Above {moisture_reject}%! Mandi weighing hold; drying required."
            ),
        },
        {
            "step": 4,
            "title_hi": "कुल शुद्ध भुगतान राशि",
            "title_en": "Net Entitled Payout",
            "desc_hi": f"पात्र मात्रा: {eligible_qty} क्विंटल × ₹{total_rate} - कटौती = {display_rupees(net_payout_paise)}",
            "desc_en": f"Eligible Qty: {eligible_qty} qtl × ₹{total_rate} - deductions = {display_rupees(net_payout_paise)}",
        }
    ]

    return {
        "crop_type": crop,
        "crop_name_hi": crop_name_hi,
        "crop_name_en": crop_name_en,
        "acres": float(acres),
        "cap_quintals": float(cap_qtl),
        "statutory_cap_quintals": float(cap_qtl),
        "offered_quintals": float(offered),
        "eligible_quintals": float(eligible_qty),
        "excess_quintals": float(excess_qty),
        "paddy_grade": req.grade,
        "msp_rate_per_quintal": msp_rate,
        "kuy_rate_per_quintal": kuy_rate,
        "total_rate_per_quintal": total_rate,
        "msp_rate_paise": msp_rate * 100,
        "kuy_rate_paise": kuy_rate * 100,
        "composite_rate_paise": total_rate * 100,
        "msp_gross_paise": msp_gross_paise,
        "kuy_gross_paise": kuy_gross_paise,
        "total_gross_paise": total_gross_paise,
        "moisture_pct": float(moisture),
        "moisture_status": moisture_status,
        "moisture_deduction_paise": moisture_deduction_paise,
        "net_payout_paise": net_payout_paise,
        "net_payout_display": display_rupees(net_payout_paise),
        "actual_received_paise": actual_received,
        "actual_display": display_rupees(actual_received),
        "gap_paise": gap_paise,
        "gap_display": display_rupees(gap_paise),
        "is_rejected": is_rejected,
        "rule_id": "PADDY_QTY_CAP_PER_ACRE",
        "rule_steps": rule_steps,
        "rupees_in_words_hi": rupees_to_hindi_words(net_payout_paise),
        "rupees_in_words_en": rupees_to_english_words(net_payout_paise),
        "provenance": "Food Dept CG & MoA&FW • Nov 2026",
    }


@router.post("/calculate-pmfby")
def calculate_pmfby_interactive(req: InteractivePMFBYRequest):
    """Pure-Python interactive PMFBY claim calculation."""
    from decimal import ROUND_HALF_UP
    acres = Decimal(str(req.acres))
    sum_insured_per_acre = Decimal(req.sum_insured_per_acre_paise) / Decimal(100)
    total_sum_insured_paise = int((acres * sum_insured_per_acre * Decimal(100)).to_integral_value(rounding=ROUND_HALF_UP))

    season = req.season.upper()
    premium_pct = Decimal("2.0") if season == "KHARIF" else (Decimal("1.5") if season == "RABI" else Decimal("5.0"))
    farmer_premium_paise = int((Decimal(total_sum_insured_paise) * (premium_pct / Decimal(100))).to_integral_value(rounding=ROUND_HALF_UP))

    threshold = Decimal(str(req.threshold_yield_kg))
    actual = Decimal(str(req.actual_yield_kg))

    if threshold > 0 and actual < threshold:
        shortfall_kg = threshold - actual
        claim_ratio = shortfall_kg / threshold
        claim_paise = int((Decimal(total_sum_insured_paise) * claim_ratio).to_integral_value(rounding=ROUND_HALF_UP))
        claim_eligible = True
    else:
        shortfall_kg = Decimal("0.0")
        claim_ratio = Decimal("0.0")
        claim_paise = 0
        claim_eligible = False

    actual_claim_received = req.actual_claim_received_paise if req.actual_claim_received_paise is not None else claim_paise
    gap_paise = max(0, claim_paise - actual_claim_received)

    rule_steps = [
        {
            "step": 1,
            "title_hi": f"प्रीमियम सीमा सत्यापन ({premium_pct}% {season})",
            "title_en": f"Farmer Premium Cap Verification ({premium_pct}% {season})",
            "desc_hi": f"कुल बीमित राशि: {display_rupees(total_sum_insured_paise)} पर किसान का अधिकतम अंशदान: {display_rupees(farmer_premium_paise)}",
            "desc_en": f"Total Sum Insured: {display_rupees(total_sum_insured_paise)}, Maximum Farmer Premium: {display_rupees(farmer_premium_paise)}",
        },
        {
            "step": 2,
            "title_hi": "थ्रेशोल्ड उपज बनाम वास्तविक सीसीई उपज",
            "title_en": "Threshold Yield vs. Actual CCE Yield",
            "desc_hi": f"थ्रेशोल्ड उपज: {threshold} क्विंटल/हेक्टेयर | वास्तविक सीसीई उपज: {actual} क्विंटल/हेक्टेयर | उपज कमी: {shortfall_kg} क्विंटल/हे.",
            "desc_en": f"Threshold Yield: {threshold} qtl/ha | Actual CCE Yield: {actual} qtl/ha | Yield Shortfall: {shortfall_kg} qtl/ha",
        },
        {
            "step": 3,
            "title_hi": "वैधानिक दावा गणना सूत्र",
            "title_en": "Statutory Claim Formula",
            "desc_hi": f"दावा = [(थ्रेशोल्ड {threshold} - वास्तविक {actual}) / थ्रेशोल्ड {threshold}] × बीमित राशि = {display_rupees(claim_paise)}",
            "desc_en": f"Claim = [(Threshold {threshold} - Actual {actual}) / Threshold {threshold}] × Sum Insured = {display_rupees(claim_paise)}",
        },
        {
            "step": 4,
            "title_hi": "72 घंटे स्थानीय आपदा सूचना चेतावनी",
            "title_en": "72-Hour Calamity Intimation Mandate",
            "desc_hi": "ओलावृष्टि, चक्रवात अथवा जलभराव होने पर 72 घंटे के भीतर टोल-फ्री 14447 पर सूचना अनिवार्य है।",
            "desc_en": "Intimation via toll-free 14447 within 72 hours of localized calamity is mandatory.",
        }
    ]

    return {
        "acres": float(acres),
        "season": season,
        "premium_pct": float(premium_pct),
        "farmer_premium_paise": farmer_premium_paise,
        "farmer_premium_display": display_rupees(farmer_premium_paise),
        "total_sum_insured_paise": total_sum_insured_paise,
        "sum_insured_display": display_rupees(total_sum_insured_paise),
        "threshold_yield_kg": float(threshold),
        "actual_yield_kg": float(actual),
        "shortfall_kg": float(shortfall_kg),
        "claim_ratio_pct": float(claim_ratio * 100),
        "claim_eligible": claim_eligible,
        "claim_paise": claim_paise,
        "claim_display": display_rupees(claim_paise),
        "actual_received_paise": actual_claim_received,
        "actual_display": display_rupees(actual_claim_received),
        "gap_paise": gap_paise,
        "gap_display": display_rupees(gap_paise),
        "rule_id": "RULE_PMFBY_CLAIM",
        "rule_steps": rule_steps,
        "rupees_in_words_hi": rupees_to_hindi_words(claim_paise),
        "rupees_in_words_en": rupees_to_english_words(claim_paise),
        "provenance": "rules_2026.json • Nov 2026",
    }



@router.post("/explain-rejection", response_model=OutsideRejectionResponse)
def explain_rejection(req: OutsideRejectionRequest):
    """Evaluate a farmer-selected rejection reason chip against statutory rules for any crop."""
    crop = req.crop_name or "Paddy"

    # Handle custom reason / Other
    if req.reason_chip in ("REJ-OTHER", "REJ_OTHER") or req.custom_reason:
        reason_txt = req.custom_reason.strip() if req.custom_reason else "अन्य प्रशासनिक कारण"
        return OutsideRejectionResponse(
            verdict="WRONGFUL",
            explanation_hi=f"फसल '{crop}' के लिए मंडी/प्राधिकारी द्वारा दिया गया कारण: '{reason_txt}'। राज्य सरकार के वैधानिक नियमों में इस आधार पर उपार्जन रोकने का कोई प्रावधान नहीं है। यह अस्वीकृति अनुचित प्रतीत होती है।",
            explanation_en=f"Reported reason for crop '{crop}': '{reason_txt}'. Statutory procurement guidelines do not allow rejection on this unverified ground. This rejection appears wrongful.",
            speech_text_hi=f"फसल {crop} हेतु दिया गया कारण वैधानिक नियमों के विपरीत है। आप तुरंत शिकायत प्रतिवेदन तैयार कर सकते हैं।",
            speech_text_en=f"The stated rejection reason for crop {crop} violates statutory rules. You can submit a grievance representation.",
            suggested_action="GENERATE_GRIEVANCE",
        )

    # Handle moisture for any crop
    if req.reason_chip in ("REJ-MOISTURE", "REJ_PADDY_MOISTURE_EXCEEDED"):
        threshold = Decimal("17.0") if crop.lower() in ("paddy", "धान") else Decimal("14.0")
        if req.moisture_pct:
            m = Decimal(req.moisture_pct)
            if m <= threshold:
                return OutsideRejectionResponse(
                    verdict="WRONGFUL",
                    explanation_hi=f"फसल '{crop}' में मापी गई नमी {m}% है, जो वैधानिक सीमा ({threshold}%) के भीतर है। मंडी द्वारा अस्वीकृति अनुचित है।",
                    explanation_en=f"Measured moisture for crop '{crop}' is {m}%, which is within the statutory limit ({threshold}%). Rejection is wrongful.",
                    speech_text_hi=f"फसल {crop} में नमी {m} प्रतिशत है जो मान्य सीमा के भीतर है। यह अस्वीकृति ग़लत है।",
                    speech_text_en=f"Crop moisture is {m} percent which is acceptable. Rejection is wrongful.",
                    suggested_action="GENERATE_GRIEVANCE",
                )
            else:
                return OutsideRejectionResponse(
                    verdict="CANNOT_VERIFY",
                    explanation_hi=f"फसल '{crop}' में नमी {m}% दर्ज की गई है, जो वैधानिक सीमा ({threshold}%) से अधिक है। फसल को सुखाकर पुनः मंडी लाएं।",
                    explanation_en=f"Measured moisture for crop '{crop}' is {m}%, exceeding statutory limit of {threshold}%. Crop needs drying before procurement.",
                    speech_text_hi=f"फसल {crop} में नमी {m} प्रतिशत है जो निर्धारित सीमा से अधिक है। कृपया सुखाकर पुनः लाएं।",
                    speech_text_en=f"Moisture for crop {crop} exceeds {threshold} percent limit. Please dry the crop and return.",
                    suggested_action="DRY_AND_RETURN",
                )

    # Handle land limit
    if req.reason_chip in ("REJ-LAND-LIMIT", "REJ_PADDY_EXCESS_QUANTITY"):
        if req.paddy_acres and req.quantity_offered_quintals:
            acres = Decimal(req.paddy_acres)
            offered = Decimal(req.quantity_offered_quintals)
            cap = paddy_quantity_cap(acres, 21)
            if offered <= cap:
                return OutsideRejectionResponse(
                    verdict="WRONGFUL",
                    explanation_hi=f"प्रस्तावित मात्रा {offered} क्विंटल आपके पंजीकृत रकबे ({acres} एकड़) की सीमा ({cap} क्विंटल) के भीतर है। अस्वीकृति ग़लत है।",
                    explanation_en=f"Offered quantity of {offered} qtl is strictly within the statutory cap of {cap} qtl for {acres} acres.",
                    speech_text_hi=f"आपकी मात्रा {offered} क्विंटल मान्य सीमा {cap} क्विंटल के भीतर है। अस्वीकृति अनुचित है।",
                    speech_text_en=f"Your quantity of {offered} quintals is within the cap of {cap} quintals. Rejection is wrongful.",
                    suggested_action="GENERATE_GRIEVANCE",
                )
            else:
                return OutsideRejectionResponse(
                    verdict="CANNOT_VERIFY",
                    explanation_hi=f"प्रस्तावित मात्रा {offered} क्विंटल सीमा {cap} क्विंटल से अधिक है। केवल {cap} क्विंटल तक की ही खरीद हो सकती है।",
                    explanation_en=f"Offered quantity {offered} qtl exceeds statutory cap of {cap} qtl.",
                    speech_text_hi=f"प्रस्तावित मात्रा निर्धारित सीमा से अधिक है। केवल {cap} क्विंटल ही पात्र है।",
                    speech_text_en=f"Quantity exceeds statutory cap. Only {cap} quintals can be procured.",
                    suggested_action="SHOW_RECEIPT_AT_BRANCH",
                )

    engine = RulesEngine()
    data = {}
    if req.paddy_acres:
        data["paddy_acres"] = Decimal(req.paddy_acres)
    if req.quantity_offered_quintals:
        data["quantity_offered_quintals"] = Decimal(req.quantity_offered_quintals)
    if req.moisture_pct:
        data["moisture_pct"] = Decimal(req.moisture_pct)

    res = engine.explain_outside_rejection(
        OutsideRejectionInput(
            farmer_selected_reason_code=req.reason_chip,
            actual_data=data,
        )
    )

    verdict = res["verdict"]
    if verdict == RejectionVerdict.WRONGFUL.value:
        explanation_hi = f"फसल '{crop}' हेतु नियम अनुसार आपकी मात्रा स्वीकार्य सीमा के भीतर है। यह अस्वीकृति अनुचित है।"
        explanation_en = f"According to rules for crop '{crop}', your quantity is within statutory cap. This rejection appears wrongful."
        speech_hi = f"नियमों के अनुसार फसल {crop} की यह अस्वीकृति ग़लत है। आप तुरंत शिकायत दर्ज कर सकते हैं।"
        speech_en = f"According to statutory rules for crop {crop}, this rejection is wrongful. You can generate a grievance representation."
        action = "GENERATE_GRIEVANCE"
    else:
        explanation_hi = f"फसल '{crop}' के लिए संबंधित एजेंसी का कोई आधिकारिक डेटा दर्ज नहीं है। कृपया लिखित कारण माँगें।"
        explanation_en = f"No official registry record found for crop '{crop}'. Please request a written reason."
        speech_hi = "अस्वीकृति का आधिकारिक कारण उपलब्ध नहीं है। कृपया संस्था से लिखित कारण प्राप्त करें।"
        speech_en = "No authoritative reason is available. Please ask the institution for the reason in writing."
        action = "SHOW_RECEIPT_AT_BRANCH"

    return OutsideRejectionResponse(
        verdict=verdict,
        explanation_hi=explanation_hi,
        explanation_en=explanation_en,
        speech_text_hi=speech_hi,
        speech_text_en=speech_en,
        suggested_action=action,
    )


# ── Grievances & Case Management ─────────────────────────────────────

@router.post("/cases", response_model=CaseSchema)
def create_case(
    req: CreateCaseRequest,
    farmer: Farmer = Depends(get_current_farmer),
    db: Session = Depends(get_db),
):
    """Create a new grievance case with tamper-evident audit hash."""
    case_count = db.query(Case).count() + 1
    while db.query(Case).filter(Case.id == f"CASE-2026-{case_count:04d}").first():
        case_count += 1
    case_id = f"CASE-2026-{case_count:04d}"
    case_ref = f"CG-{farmer.district[:3].upper()}-2026-{case_count:04d}"

    # Audit block creation
    audit_service = AuditChainService()
    last_event = db.query(AuditEvent).order_by(AuditEvent.id.desc()).first()
    if last_event:
        audit_service._head_hash = last_event.entry_hash

    entry = audit_service.append_event(
        actor=farmer.id,
        action="GRIEVANCE_CASE_FILED",
        payload={
            "case_id": case_id,
            "scheme_id": req.scheme_id,
            "gap_paise": req.gap_paise,
            "authority": req.authority_name,
        },
        subject=farmer.id,
    )

    new_case = Case(
        id=case_id,
        case_ref_no=case_ref,
        farmer_id=farmer.id,
        parcel_id=req.parcel_id,
        authority_name=req.authority_name,
        authority_designation=req.authority_designation,
        scheme_id=req.scheme_id,
        status="LETTER_GENERATED",
        entitled_paise=req.entitled_paise,
        actual_paise=req.actual_paise,
        gap_paise=req.gap_paise,
        details=req.details,
        verification_hash=entry.entry_hash,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_case)

    # Persist audit event
    db.add(AuditEvent(
        prev_hash=entry.prev_hash,
        entry_hash=entry.entry_hash,
        actor=entry.actor,
        subject=entry.subject,
        action=entry.action,
        payload_json=f'{{"case_id": "{case_id}", "gap_paise": {req.gap_paise}}}',
        timestamp=datetime.now(timezone.utc),
    ))
    db.commit()

    return CaseSchema(
        id=new_case.id,
        case_ref_no=new_case.case_ref_no,
        farmer_id=new_case.farmer_id,
        parcel_id=new_case.parcel_id,
        authority_name=new_case.authority_name,
        authority_designation=new_case.authority_designation,
        scheme_id=new_case.scheme_id,
        status=new_case.status,
        entitled_paise=new_case.entitled_paise,
        entitled_display=display_rupees(new_case.entitled_paise),
        actual_paise=new_case.actual_paise,
        actual_display=display_rupees(new_case.actual_paise),
        gap_paise=new_case.gap_paise,
        gap_display=display_rupees(new_case.gap_paise),
        details=new_case.details,
        verification_hash=new_case.verification_hash,
        created_at=new_case.created_at.isoformat(),
        updated_at=new_case.updated_at.isoformat(),
    )


@router.get("/cases", response_model=list[CaseSchema])
def list_cases(
    farmer: Farmer = Depends(get_current_farmer),
    db: Session = Depends(get_db),
):
    """List all grievance cases for the logged-in farmer."""
    cases = db.query(Case).filter(Case.farmer_id == farmer.id).order_by(Case.created_at.desc()).all()
    return [
        CaseSchema(
            id=c.id,
            case_ref_no=c.case_ref_no,
            farmer_id=c.farmer_id,
            parcel_id=c.parcel_id,
            authority_name=c.authority_name,
            authority_designation=c.authority_designation,
            scheme_id=c.scheme_id,
            status=c.status,
            entitled_paise=c.entitled_paise,
            entitled_display=display_rupees(c.entitled_paise),
            actual_paise=c.actual_paise,
            actual_display=display_rupees(c.actual_paise),
            gap_paise=c.gap_paise,
            gap_display=display_rupees(c.gap_paise),
            details=c.details,
            verification_hash=c.verification_hash,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        )
        for c in cases
    ]


@router.get("/cases/{case_id}/letter")
def download_letter(
    case_id: str,
    language: str = "hi",
    farmer: Farmer = Depends(get_current_farmer),
    db: Session = Depends(get_db),
):
    """Generate locked grievance representation document in Hindi or English."""
    case = db.query(Case).filter(Case.id == case_id, Case.farmer_id == farmer.id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or unauthorized.")

    # Parcels
    parcels = db.query(LandParcel).filter(LandParcel.farmer_id == farmer.id).all()
    affected_parcels = [
        {
            "khasra_no": p.khasra_no,
            "hectares": str(p.area_ha),
            "area_acres": str(quantize_2dp(ha_to_acres(p.area_ha))),
            "crop": p.girdawari_crop,
            "entitled_rupees": display_rupees(case.entitled_paise),
            "received_rupees": display_rupees(case.actual_paise),
            "shortfall_rupees": display_rupees(case.gap_paise),
        }
        for p in parcels
    ]

    tmpl_service = TemplateService()
    context = {
        "farmer_name": farmer.name_hi if language == "hi" else farmer.name_en,
        "father_name": farmer.father_name_hi if language == "hi" else farmer.father_name_en,
        "mobile_masked": farmer.masked_mobile,
        "village": farmer.village,
        "tehsil": farmer.tehsil,
        "district": farmer.district,
        "authority_name": case.authority_name,
        "authority_designation": case.authority_designation,
        "date_today": date.today().strftime("%d/%m/%Y"),
        "case_id": case.case_ref_no,
        "affected_parcels": affected_parcels,
        "entitled_amount_display": display_rupees(case.entitled_paise),
        "entitled_amount_words": rupees_to_hindi_words(case.entitled_paise) if language == "hi" else rupees_to_english_words(case.entitled_paise),
        "actual_amount_display": display_rupees(case.actual_paise),
        "gap_amount_display": display_rupees(case.gap_paise),
        "discrepancy_reason": case.details,
        "next_action": "शीघ्र जाँच कर अवशेष राशि का भुगतान किया जाए।",
        "rule_reference": case.scheme_id,
        "verification_hash": case.verification_hash,
    }

    html_content = tmpl_service.render_grievance_letter(context, language=language)
    return HTMLResponse(content=html_content)


@router.patch("/cases/{case_id}/status", response_model=CaseSchema)
def update_case_status(
    case_id: str,
    req: UpdateCaseStatusRequest,
    farmer: Farmer = Depends(get_current_farmer),
    db: Session = Depends(get_db),
):
    """
    Live Case Timeline:
    DETECTED -> LETTER_GENERATED -> FILED -> FOLLOWUP_DUE -> ESCALATED -> RESOLVED
    """
    case = db.query(Case).filter(Case.id == case_id, Case.farmer_id == farmer.id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or unauthorized.")

    valid_statuses = ("DETECTED", "LETTER_GENERATED", "FILED", "FOLLOWUP_DUE", "ESCALATED", "RESOLVED")
    new_stat = req.new_status.upper()
    if new_stat not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")

    case.status = new_stat
    case.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(case)

    return CaseSchema(
        id=case.id,
        case_ref_no=case.case_ref_no,
        farmer_id=case.farmer_id,
        parcel_id=case.parcel_id,
        authority_name=case.authority_name,
        authority_designation=case.authority_designation,
        scheme_id=case.scheme_id,
        status=case.status,
        entitled_paise=case.entitled_paise,
        entitled_display=display_rupees(case.entitled_paise),
        actual_paise=case.actual_paise,
        actual_display=display_rupees(case.actual_paise),
        gap_paise=case.gap_paise,
        gap_display=display_rupees(case.gap_paise),
        details=case.details,
        verification_hash=case.verification_hash,
        created_at=case.created_at.isoformat(),
        updated_at=case.updated_at.isoformat(),
    )


# ─────────────────────────────────────────────────────────────────
# 10b. Scheme Applications & Payout Discrepancy Engine (Loop 1)
# ─────────────────────────────────────────────────────────────────

def _evaluate_scheme_discrepancy(
    entitled_paise: int,
    actual_received_paise: int,
    expected_release_date: Optional[date],
    scheme_code: str,
    scheme_name: str,
) -> dict:
    gap_paise = max(0, entitled_paise - actual_received_paise)
    today = date.today()

    if abs(entitled_paise - actual_received_paise) <= 100:
        verdict = "NO_DISCREPANCY"
        verdict_badge = "Full Amount Received — No Discrepancy"
        badge_color = "GREEN"
        rule_steps = [
            {"step": 1, "title": "Statutory Entitlement Check", "desc": f"Rule-mandated payment entitlement is {display_rupees(entitled_paise)}."},
            {"step": 2, "title": "Account Credit Verification", "desc": f"Account credit confirms {display_rupees(actual_received_paise)} received."},
            {"step": 3, "title": "Discrepancy Audit", "desc": "Difference is within statutory tolerance (₹0). No deficit detected."},
        ]
    elif actual_received_paise == 0 and expected_release_date and expected_release_date >= today:
        verdict = "PENDING_RELEASE"
        exp_str = expected_release_date.strftime("%d %b %Y")
        verdict_badge = f"Pending — Expected by {exp_str} (No Complaint Needed Yet)"
        badge_color = "BLUE"
        rule_steps = [
            {"step": 1, "title": "Eligibility & Sanction", "desc": f"Sanctioned entitlement of {display_rupees(entitled_paise)} under official guidelines."},
            {"step": 2, "title": "Disbursement Cycle", "desc": f"Scheduled release date is {exp_str} as per department DBT batch."},
            {"step": 3, "title": "Grievance Window", "desc": "Disbursement window is currently active; representation is not required before cutoff."},
        ]
    else:
        verdict = "DISCREPANCY_DETECTED"
        verdict_badge = f"Discrepancy Detected: {display_rupees(gap_paise)} Shortfall"
        badge_color = "RED"
        rule_steps = [
            {"step": 1, "title": "Rule-Computed Entitlement", "desc": f"Under statutory rules, entitled amount is {display_rupees(entitled_paise)}."},
            {"step": 2, "title": "Actual Disbursement Recorded", "desc": f"Actual received/paid amount recorded is {display_rupees(actual_received_paise)}."},
            {"step": 3, "title": "Statutory Gap Calculation", "desc": f"Net actionable discrepancy is {display_rupees(gap_paise)}. Formal representation may be submitted."},
        ]

    return {
        "verdict": verdict,
        "verdict_badge": verdict_badge,
        "badge_color": badge_color,
        "gap_paise": gap_paise,
        "gap_display": display_rupees(gap_paise),
        "rule_steps": rule_steps,
    }


@router.post("/schemes/apply")
def apply_farmer_scheme(
    req: FarmerSchemeApplyRequest,
    farmer: Farmer = Depends(get_current_farmer),
    db: Session = Depends(get_db),
):
    """
    Persist applied scheme + rule-computed entitled_paise into SQLite farmer_scheme_applications.
    Idempotent per farmer + scheme.
    """
    app_id = f"FSA-{farmer.id}-{req.scheme_code}"
    existing = db.query(FarmerSchemeApplication).filter(
        FarmerSchemeApplication.farmer_id == farmer.id,
        FarmerSchemeApplication.scheme_code == req.scheme_code,
    ).first()

    exp_date = None
    if req.expected_release_date:
        try:
            exp_date = date.fromisoformat(req.expected_release_date)
        except Exception:
            pass

    if existing:
        existing.entitled_paise = req.entitled_paise
        existing.status = "APPLIED"
        if req.official_portal_url:
            existing.official_portal_url = req.official_portal_url
        if exp_date:
            existing.expected_release_date = exp_date
        db.commit()
        db.refresh(existing)
        target = existing
    else:
        new_app = FarmerSchemeApplication(
            id=app_id,
            farmer_id=farmer.id,
            scheme_code=req.scheme_code,
            scheme_name=req.scheme_name,
            entitled_paise=req.entitled_paise,
            actual_received_paise=0,
            expected_release_date=exp_date or date(2026, 12, 15),
            official_portal_url=req.official_portal_url or "https://kisan.cg.nic.in",
            applied_at=datetime.now(timezone.utc),
            status="APPLIED",
        )
        db.add(new_app)
        db.commit()
        db.refresh(new_app)
        target = new_app

    eval_data = _evaluate_scheme_discrepancy(
        entitled_paise=target.entitled_paise,
        actual_received_paise=target.actual_received_paise,
        expected_release_date=target.expected_release_date,
        scheme_code=target.scheme_code,
        scheme_name=target.scheme_name,
    )

    return {
        "status": "APPLIED",
        "message": "Application tracked in Gaps & Cases",
        "application": {
            "id": target.id,
            "scheme_code": target.scheme_code,
            "scheme_name": target.scheme_name,
            "entitled_paise": target.entitled_paise,
            "entitled_display": display_rupees(target.entitled_paise),
            "actual_received_paise": target.actual_received_paise,
            "actual_received_display": display_rupees(target.actual_received_paise),
            "expected_release_date": target.expected_release_date.isoformat() if target.expected_release_date else None,
            "official_portal_url": target.official_portal_url,
            "applied_at": target.applied_at.isoformat() if target.applied_at else None,
            "status": target.status,
            **eval_data,
        }
    }


@router.get("/applied-schemes")
def get_applied_schemes(
    farmer: Farmer = Depends(get_current_farmer),
    db: Session = Depends(get_db),
):
    """
    Section A of Gaps & Cases:
    Returns every scheme applied for in Scheme Eligibility,
    pre-seeding active demo schemes if none exist yet.
    """
    # Seed demo active schemes only if farmer has ZERO records ever
    total_count = db.query(FarmerSchemeApplication).filter(
        FarmerSchemeApplication.farmer_id == farmer.id
    ).count()

    if total_count == 0:
        demo_seeds = [
            FarmerSchemeApplication(
                id=f"FSA-{farmer.id}-KUY",
                farmer_id=farmer.id,
                scheme_code="RULE_KUY_PADDY",
                scheme_name="Krishak Unnati Yojana (कृषक उन्नति योजना - धान इनपुट सहायता)",
                entitled_paise=2849600,
                actual_received_paise=1800000,
                expected_release_date=date(2026, 11, 10),
                official_portal_url="https://kisan.cg.nic.in",
                applied_at=datetime(2026, 11, 1, 10, 0, tzinfo=timezone.utc),
                status="APPLIED",
            ),
            FarmerSchemeApplication(
                id=f"FSA-{farmer.id}-KCC",
                farmer_id=farmer.id,
                scheme_code="RULE_KCC_SUBVENTION",
                scheme_name="KCC 4% MISS Interest Subvention (अल्पावधि फसल ऋण ब्याज अनुदान)",
                entitled_paise=600000,
                actual_received_paise=600000,
                expected_release_date=date(2026, 10, 31),
                official_portal_url="https://pmkisan.gov.in/KCC.aspx",
                applied_at=datetime(2026, 10, 15, 9, 30, tzinfo=timezone.utc),
                status="APPLIED",
            ),
            FarmerSchemeApplication(
                id=f"FSA-{farmer.id}-PMFBY",
                farmer_id=farmer.id,
                scheme_code="RULE_PMFBY_CLAIM",
                scheme_name="PMFBY Kharif 2026 Crop Loss Insurance Claim (फसल बीमा दावा)",
                entitled_paise=3360000,
                actual_received_paise=0,
                expected_release_date=date(2026, 12, 25),
                official_portal_url="https://pmfby.gov.in",
                applied_at=datetime(2026, 11, 5, 14, 0, tzinfo=timezone.utc),
                status="APPLIED",
            ),
        ]
        for s in demo_seeds:
            db.add(s)
        db.commit()

    # Section A displays active tracked schemes (completed or moved to grievance are removed from Section A)
    apps = db.query(FarmerSchemeApplication).filter(
        FarmerSchemeApplication.farmer_id == farmer.id,
        FarmerSchemeApplication.status.in_(["APPLIED", "ACTIVE", "UNDER_REVIEW"])
    ).order_by(FarmerSchemeApplication.applied_at.desc()).all()

    result_list = []
    for a in apps:
        eval_data = _evaluate_scheme_discrepancy(
            entitled_paise=a.entitled_paise,
            actual_received_paise=a.actual_received_paise,
            expected_release_date=a.expected_release_date,
            scheme_code=a.scheme_code,
            scheme_name=a.scheme_name,
        )
        result_list.append({
            "id": a.id,
            "farmer_id": a.farmer_id,
            "scheme_code": a.scheme_code,
            "scheme_name": a.scheme_name,
            "entitled_paise": a.entitled_paise,
            "entitled_display": display_rupees(a.entitled_paise),
            "actual_received_paise": a.actual_received_paise,
            "actual_received_display": display_rupees(a.actual_received_paise),
            "expected_release_date": a.expected_release_date.isoformat() if a.expected_release_date else None,
            "official_portal_url": a.official_portal_url,
            "applied_at": a.applied_at.isoformat() if a.applied_at else None,
            "status": a.status,
            "rule_id": a.scheme_code,
            "provenance": "rules_2026.json • Nov 2026",
            "discrepancy_verdict": eval_data["verdict"],
            "verdict_badge": eval_data["verdict_badge"],
            "badge_color": eval_data["badge_color"],
            "gap_paise": eval_data["gap_paise"],
            "gap_display": eval_data["gap_display"],
            "rule_steps": eval_data["rule_steps"],
        })

    return {
        "farmer_id": farmer.id,
        "applied_schemes": result_list,
    }


@router.patch("/applied-schemes/{application_id}/received")
def update_applied_scheme_received(
    application_id: str,
    req: UpdateAppliedSchemeReceivedRequest,
    farmer: Farmer = Depends(get_current_farmer),
    db: Session = Depends(get_db),
):
    """
    Interactive 'Amount Actually Received' update -> runs live deterministic rules engine.
    """
    app_record = db.query(FarmerSchemeApplication).filter(
        FarmerSchemeApplication.id == application_id,
        FarmerSchemeApplication.farmer_id == farmer.id,
    ).first()
    if not app_record:
        raise HTTPException(status_code=404, detail="Applied scheme record not found.")

    if req.actual_received_paise is not None:
        app_record.actual_received_paise = req.actual_received_paise
    elif req.actual_received_rupees is not None:
        app_record.actual_received_paise = int(req.actual_received_rupees * 100)

    db.commit()
    db.refresh(app_record)

    eval_data = _evaluate_scheme_discrepancy(
        entitled_paise=app_record.entitled_paise,
        actual_received_paise=app_record.actual_received_paise,
        expected_release_date=app_record.expected_release_date,
        scheme_code=app_record.scheme_code,
        scheme_name=app_record.scheme_name,
    )

    return {
        "id": app_record.id,
        "farmer_id": app_record.farmer_id,
        "scheme_code": app_record.scheme_code,
        "scheme_name": app_record.scheme_name,
        "entitled_paise": app_record.entitled_paise,
        "entitled_display": display_rupees(app_record.entitled_paise),
        "actual_received_paise": app_record.actual_received_paise,
        "actual_received_display": display_rupees(app_record.actual_received_paise),
        "expected_release_date": app_record.expected_release_date.isoformat() if app_record.expected_release_date else None,
        "official_portal_url": app_record.official_portal_url,
        "applied_at": app_record.applied_at.isoformat() if app_record.applied_at else None,
        "status": app_record.status,
        "rule_id": app_record.scheme_code,
        "provenance": "rules_2026.json • Nov 2026",
        "discrepancy_verdict": eval_data["verdict"],
        "verdict_badge": eval_data["verdict_badge"],
        "badge_color": eval_data["badge_color"],
        "gap_paise": eval_data["gap_paise"],
        "gap_display": eval_data["gap_display"],
        "rule_steps": eval_data["rule_steps"],
    }


@router.post("/applied-schemes/{application_id}/resolve")
def resolve_applied_scheme(
    application_id: str,
    farmer: Farmer = Depends(get_current_farmer),
    db: Session = Depends(get_db),
):
    """
    Farmer confirms money received successfully in full -> marks COMPLETED and removes from Section A.
    """
    app_record = db.query(FarmerSchemeApplication).filter(
        FarmerSchemeApplication.id == application_id,
        FarmerSchemeApplication.farmer_id == farmer.id,
    ).first()
    if not app_record:
        raise HTTPException(status_code=404, detail="Applied scheme record not found.")

    app_record.status = "COMPLETED"
    app_record.actual_received_paise = app_record.entitled_paise
    db.commit()

    return {
        "success": True,
        "status": "COMPLETED",
        "message": "Money received successfully. Scheme marked as completed and removed from Section A.",
    }


@router.post("/applied-schemes/{application_id}/move-to-grievance")
def move_applied_scheme_to_grievance(
    application_id: str,
    farmer: Farmer = Depends(get_current_farmer),
    db: Session = Depends(get_db),
):
    """
    Discrepancy identified: creates official grievance case in Section B and removes from Section A.
    """
    app_record = db.query(FarmerSchemeApplication).filter(
        FarmerSchemeApplication.id == application_id,
        FarmerSchemeApplication.farmer_id == farmer.id,
    ).first()
    if not app_record:
        raise HTTPException(status_code=404, detail="Applied scheme record not found.")

    gap_paise = max(0, app_record.entitled_paise - app_record.actual_received_paise)
    effective_gap = gap_paise if gap_paise > 0 else app_record.entitled_paise
    authority_name = (
        "District Procurement Officer / Markfed"
        if ("KUY" in app_record.scheme_code or "PADDY" in app_record.scheme_code)
        else ("Lead District Manager (LDM) / Bank Branch" if "KCC" in app_record.scheme_code else "District PMFBY Oversight Committee")
    )
    authority_designation = (
        "District Supply & Procurement Division"
        if ("KUY" in app_record.scheme_code or "PADDY" in app_record.scheme_code)
        else ("Agricultural Credit Division" if "KCC" in app_record.scheme_code else "State Crop Insurance Cell")
    )

    case_count = db.query(Case).count() + 1
    while db.query(Case).filter(Case.id == f"CASE-2026-{case_count:04d}").first():
        case_count += 1
    case_id = f"CASE-2026-{case_count:04d}"
    case_ref = f"CG-{(farmer.district or 'RAI')[:3].upper()}-2026-{case_count:04d}"

    # Append Audit Event for Grievance creation
    audit_service = AuditChainService()
    last_event = db.query(AuditEvent).order_by(AuditEvent.id.desc()).first()
    if last_event:
        audit_service._head_hash = last_event.entry_hash

    entry = audit_service.append_event(
        actor=farmer.id,
        action="SCHEME_DISCREPANCY_GRIEVANCE_FILED",
        payload={
            "case_id": case_id,
            "scheme_id": app_record.scheme_code,
            "gap_paise": effective_gap,
            "authority": authority_name,
        },
        subject=farmer.id,
    )
    db.add(
        AuditEvent(
            prev_hash=entry.prev_hash,
            entry_hash=entry.entry_hash,
            actor=entry.actor,
            subject=entry.subject,
            action=entry.action,
            payload_json=json.dumps(entry.payload),
            timestamp=datetime.now(timezone.utc),
        )
    )

    ent_disp = display_rupees(app_record.entitled_paise)
    act_disp = display_rupees(app_record.actual_received_paise)
    gap_disp = display_rupees(effective_gap)
    khasra_str = farmer.parcels[0].khasra_no if (farmer.parcels and len(farmer.parcels) > 0) else "142/1"

    if gap_paise > 0:
        letter_hi = (
            f"सेवा में,\n{authority_name},\n{authority_designation},\n"
            f"विषय: {app_record.scheme_name} अंतर्गत वैधानिक देय राशि में ₹{gap_disp} की कमी/विसंगति बाबत।\n\n"
            f"महोदय,\n"
            f"प्रार्थी {farmer.name_hi} (ग्राम: {farmer.village}, तहसील: {farmer.tehsil}, खसरा सं: {khasra_str}) "
            f"को उक्त योजना के वैधानिक नियमों के तहत {ent_disp} देय था, किन्तु बैंक/डीबीटी खाते में केवल {act_disp} प्राप्त हुआ है। "
            f"नियमानुसार शेष अंतर राशि ₹{gap_disp} का शीघ्र भुगतान सुनिश्चित करने का कष्ट करें।"
        )
    else:
        letter_hi = (
            f"सेवा में,\n{authority_name},\n{authority_designation},\n"
            f"विषय: {app_record.scheme_name} अंतर्गत नीति कार्यान्वयन एवं वैधानिक लाभ प्राप्ति में समस्या बाबत।\n\n"
            f"महोदय,\n"
            f"प्रार्थी {farmer.name_hi} (ग्राम: {farmer.village}, तहसील: {farmer.tehsil}, खसरा सं: {khasra_str}) "
            f"को उक्त योजना के तहत वैधानिक पात्रता अनुसार {ent_disp} का लाभ मिलना था, किन्तु नीतिगत रुकावट अथवा दस्तावेजी सत्यापन में समस्या के कारण यह प्रक्रिया रुकी हुई है। "
            f"कृपया इसका त्वरित समाधान कर वैधानिक लाभ प्रदान करने का कष्ट करें।"
        )

    new_case = Case(
        id=case_id,
        case_ref_no=case_ref,
        farmer_id=farmer.id,
        parcel_id=farmer.parcels[0].id if (farmer.parcels and len(farmer.parcels) > 0) else None,
        authority_name=authority_name,
        authority_designation=authority_designation,
        scheme_id=app_record.scheme_code,
        entitled_paise=app_record.entitled_paise,
        actual_paise=app_record.actual_received_paise,
        gap_paise=effective_gap,
        status="LETTER_GENERATED",
        details=letter_hi,
        verification_hash=entry.entry_hash,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_case)

    # Transition application status so it exits Section A
    app_record.status = "MOVED_TO_GRIEVANCE"
    db.commit()

    return {
        "success": True,
        "case_id": new_case.id,
        "case_ref_no": new_case.case_ref_no,
        "status": "MOVED_TO_GRIEVANCE",
        "message": "Discrepancy successfully moved to Section B Grievances.",
    }


# ─────────────────────────────────────────────────────────────────
# 11. Farmer Loans & Bank Officer Verdict Bridge (Loop 2)
# ─────────────────────────────────────────────────────────────────
@router.get("/loans-and-decisions")
@router.get("/loans")
def get_farmer_loans_and_applications(
    farmer: Farmer = Depends(get_current_farmer),
    db: Session = Depends(get_db),
):
    """
    Live connection between Bank Officer Console (/bank) and Farmer 'My Loans & Applications'
    Displays:
    1. Live Bank Officer Decisions (APPROVED / HELD / REJECTED) straight from SQLite.
    2. Existing Active & Closed Loans.
    """
    import json

    # 1. Existing Active & Closed Loans from loans table
    active_loans = db.query(Loan).filter(Loan.farmer_id == farmer.id).all()
    loans_list = []
    for l in active_loans:
        eff_rate = round((l.interest_charged_paise / l.principal_paise) * 100, 2) if l.principal_paise > 0 else 7.0
        entitled_rate = 4.0 if (l.is_kcc and l.is_repaid_timely) else 7.0
        overcharge_paise = max(0, l.interest_charged_paise - int(l.principal_paise * 0.04)) if (l.is_kcc and l.is_repaid_timely) else 0

        loans_list.append({
            "loan_id": l.id,
            "bank_name": l.bank_name,
            "lender_type": l.lender_type,
            "loan_type": l.loan_type or ("KCC" if l.is_kcc else "COMMERCIAL"),
            "principal_paise": l.principal_paise,
            "principal_display": display_rupees(l.principal_paise),
            "interest_charged_paise": l.interest_charged_paise,
            "interest_charged_display": display_rupees(l.interest_charged_paise),
            "effective_rate_pct": eff_rate,
            "entitled_rate_pct": entitled_rate,
            "overcharge_paise": overcharge_paise,
            "overcharge_display": display_rupees(overcharge_paise),
            "disbursement_date": l.disbursement_date.isoformat() if l.disbursement_date else None,
            "due_date": l.due_date.isoformat() if l.due_date else None,
            "is_repaid_timely": l.is_repaid_timely,
            "is_active": l.is_active,
            "is_kcc": l.is_kcc,
            "status": l.status or ("ACTIVE" if l.is_active else "CLOSED"),
        })

    # 2. Live Bank Officer Decisions (from bank_applications + rejections)
    parcel_ids = [p.id for p in farmer.parcels]
    parcel_khasras = [p.khasra_no for p in farmer.parcels]

    apps = db.query(BankApplication).filter(
        or_(
            BankApplication.farmer_id == farmer.id,
            BankApplication.applicant_mobile == farmer.mobile,
            BankApplication.applicant_name == farmer.name_en,
            BankApplication.applicant_name == farmer.name_hi,
            BankApplication.applicant_name.ilike(f"%{farmer.name_en}%"),
            BankApplication.applicant_name.ilike(f"%{farmer.name_hi}%"),
            BankApplication.parcel_id.in_(parcel_ids) if parcel_ids else False,
            BankApplication.parcel_id.in_(parcel_khasras) if parcel_khasras else False,
        )
    ).order_by(BankApplication.decided_at.desc(), BankApplication.created_at.desc()).all()

    rejections = db.query(Rejection).filter(
        or_(
            Rejection.farmer_id == farmer.id,
            Rejection.applicant_name == farmer.name_en,
            Rejection.applicant_name == farmer.name_hi,
        )
    ).all()
    rejections_by_app = {r.application_id: r for r in rejections}

    decisions_list = []
    for app in apps:
        rej = rejections_by_app.get(app.id)
        raw_status = (app.status or "UNDER_REVIEW").upper()
        audit_hash = app.audit_hash or (rej.audit_hash if rej else None)

        # Map flags/reasons
        flags = []
        if rej and rej.flags_json:
            try:
                flags = json.loads(rej.flags_json)
            except Exception:
                flags = []
        elif app.match_reasons_json:
            try:
                flags = json.loads(app.match_reasons_json)
            except Exception:
                flags = []

        flags_str = " ".join([str(f) for f in flags]).upper()

        if raw_status in ("APPROVE", "APPROVED"):
            item = {
                "application_id": app.id,
                "bank_name": app.lender_name,
                "loan_type": app.loan_type,
                "requested_paise": app.requested_paise,
                "requested_display": display_rupees(app.requested_paise),
                "decision": "APPROVED",
                "decided_at": (app.decided_at or app.created_at).isoformat() if (app.decided_at or app.created_at) else None,
                "audit_hash": audit_hash,
                "short_hash": f"{audit_hash[:10]}...{audit_hash[-6:]}" if audit_hash else None,
                "message_hi": "बैंक अधिकारी द्वारा स्वीकृत — संवितरण (Disbursement) हेतु तैयार",
                "message_en": "Approved by Bank Officer — Ready for Disbursement",
                "message_chh": "बैंक अधिकारी ले मंजूर — पइसा मिले बर तइयार",
                "can_dispute": False,
                "flags": flags,
                "officer_notes": app.officer_notes or (rej.officer_notes if rej else None),
            }
        elif raw_status in ("HOLD", "HELD", "REJECT", "REJECTED", "FLAGGED_REVIEW"):
            norm_decision = "REJECTED" if raw_status in ("REJECT", "REJECTED") else "HELD"
            if "DUPLICATE" in flags_str or "EXISTING" in flags_str or "ACTIVE" in flags_str:
                reason_hi = "समान खसरा/भूमि पर किसी अन्य बैंक में पहले से सक्रिय अल्पावधि फसल ऋण (KCC) दर्ज है।"
                reason_en = "Active duplicate KCC crop loan detected on the same land parcel in another bank."
                reason_chh = "एही जमीन म दूसर बैंक म पहिली ले केसीसी करजा चलत हे।"
                resp_dept = "Existing Lender & Bank Branch (ऋण प्रदाता बैंक)"
                next_hi = "मौजूदा बैंक से अनापत्ति प्रमाण पत्र (NOC / No Dues Certificate) प्राप्त कर जमा करें अथवा पुराना ऋण खाता बंद करवाएं।"
                next_en = "Obtain a No Dues Certificate (NOC) from the existing bank or clear the prior loan account."
                next_chh = "पहिली वाले बैंक ले एनओसी (NOC) प्रमाण पत्र ला के जमा करव।"
            elif "NAME" in flags_str or "IDENTITY" in flags_str or "MISMATCH" in flags_str:
                reason_hi = "भुइयां भू-अभिलेख में दर्ज नाम और बैंक आवेदन / आधार नाम में वर्तनी विसंगति।"
                reason_en = "Name spelling divergence between Revenue Record (Bhuiyan B-1) and Bank/Aadhaar identity."
                reason_chh = "भुइयां जमीन खाता अउ आधार म नाम के स्पेलिंग म फरक हे।"
                resp_dept = "Patwari & Tehsil Revenue Office (पटवारी एवं तहसील कार्यालय)"
                next_hi = "तहसीलदार/पटवारी से नाम सुधार सत्यापन प्रमाण पत्र अथवा एक ही व्यक्ति होने का शपथ पत्र (Affidavit) प्रस्तुत करें।"
                next_en = "Submit a name rectification certificate from Tehsildar/Patwari or identity affidavit."
                next_chh = "तहसीलदार या पटवारी ले नाम सुधार के पर्चा बनवा के जमा करव।"
            else:
                reason_hi = (rej.reason_hi if rej else None) or app.officer_notes or "दस्तावेज़ अपूर्ण अथवा बैंक सत्यापन लंबित होने के कारण आवेदन रोक/अस्वीकार किया गया।"
                reason_en = (rej.reason_en if rej else None) or app.officer_notes or "Application held/rejected due to document divergence or verification review."
                reason_chh = "कागजात अधूरा होय के सेती आवेदन रोके या खारिज करे गे हे।"
                resp_dept = "Bank Branch (संबंधित बैंक शाखा)"
                next_hi = "संबंधित बैंक शाखा प्रबंधक से संपर्क करें अथवा ऑनलाइन आपत्ति दर्ज करें।"
                next_en = "Contact the branch manager with original land records or register an online grievance."
                next_chh = "बैंक शाखा म जाके मूल कागजात देखाव या इहाँ ले शिकायत दर्ज करव।"

            item = {
                "application_id": app.id,
                "bank_name": app.lender_name,
                "loan_type": app.loan_type,
                "requested_paise": app.requested_paise,
                "requested_display": display_rupees(app.requested_paise),
                "decision": norm_decision,
                "decided_at": (app.decided_at or app.created_at).isoformat() if (app.decided_at or app.created_at) else None,
                "audit_hash": audit_hash,
                "short_hash": f"{audit_hash[:10]}...{audit_hash[-6:]}" if audit_hash else None,
                "reason_hi": reason_hi,
                "reason_en": reason_en,
                "reason_chh": reason_chh,
                "responsible_dept": resp_dept,
                "next_steps_hi": next_hi,
                "next_steps_en": next_en,
                "next_steps_chh": next_chh,
                "can_dispute": True,
                "flags": flags,
                "officer_notes": (rej.officer_notes if rej else None) or app.officer_notes,
            }
        else:
            item = {
                "application_id": app.id,
                "bank_name": app.lender_name,
                "loan_type": app.loan_type,
                "requested_paise": app.requested_paise,
                "requested_display": display_rupees(app.requested_paise),
                "decision": "UNDER_REVIEW",
                "decided_at": (app.decided_at or app.created_at).isoformat() if (app.decided_at or app.created_at) else None,
                "audit_hash": audit_hash,
                "short_hash": f"{audit_hash[:10]}...{audit_hash[-6:]}" if audit_hash else None,
                "message_hi": "आवेदन बैंक अधिकारी की समीक्षा कतार में है।",
                "message_en": "Application is in Bank Officer workbench review queue.",
                "message_chh": "आवेदन बैंक अधिकारी के जांच म हे।",
                "can_dispute": False,
                "flags": flags,
                "officer_notes": app.officer_notes,
            }
        item["status"] = "REJECT" if item["decision"] == "REJECTED" else item["decision"]
        if rej:
            item["rejection"] = {
                "decision": rej.decision,
                "reason_hi": rej.reason_hi,
                "reason_en": rej.reason_en,
                "flags": flags,
                "officer_notes": rej.officer_notes,
            }
        decisions_list.append(item)

    return {
        "farmer_id": farmer.id,
        "bank_decisions": decisions_list,
        "applications": decisions_list,
        "loans": loans_list,
    }


@router.post("/loan-apply")
def submit_loan_application(
    req: FarmerLoanApplyRequest,
    farmer: Farmer = Depends(get_current_farmer),
    db: Session = Depends(get_db),
):
    """Legacy endpoint preserved for API compatibility."""
    import time
    app_id = f"APP-{farmer.id}-{int(time.time())}"
    paise = int(req.requested_amount_rupees * 100)

    application = BankApplication(
        id=app_id,
        applicant_name=farmer.name_en,
        applicant_father=farmer.father_name_en,
        applicant_mobile=farmer.mobile,
        parcel_id=req.parcel_id,
        lender_name=req.lender_name,
        loan_type=req.loan_type,
        requested_paise=paise,
        status="UNDER_REVIEW",
        match_score=95.0,
        match_band="GREEN",
        match_reasons_json="[]",
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    return {
        "status": "SUBMITTED",
        "application_id": app_id,
        "message_hi": f"आपका ऋण आवेदन ({app_id}) सफलतापूर्व बैंक समीक्षा हेतु प्रेषित कर दिया गया है।",
        "message_en": f"Your loan application ({app_id}) has been submitted for bank review.",
        "application": {
            "id": application.id,
            "lender_name": application.lender_name,
            "loan_type": application.loan_type,
            "requested_paise": application.requested_paise,
            "status": application.status,
        }
    }


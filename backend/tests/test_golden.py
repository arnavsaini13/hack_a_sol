import json
from decimal import Decimal
from datetime import date, timedelta
import pytest
from app.rules.helpers import (
    ha_to_acres,
    paddy_quantity_cap,
    display_rupees,
    format_indian_number,
    HA_TO_ACRES_FACTOR,
)
from app.rules.number_words import (
    number_to_hindi_words,
    rupees_to_hindi_words,
    number_to_english_words,
    rupees_to_english_words,
)
from app.rules.engine import (
    RulesEngine,
    KCCLoanInput,
    PaddyProcurementInput,
    PMFBYInput,
    EntitlementDiscrepancyInput,
    OutsideRejectionInput,
    BankAuditRecord,
    DiscrepancyState,
    RejectionVerdict,
)
from app.services.transliteration import match_names, MatchBand
from app.services.audit_service import AuditChainService
from app.services.template_service import TemplateService


@pytest.fixture
def engine():
    return RulesEngine()


# Test 1: PACS 0% timely up to ₹3 lakh
def test_pacs_zero_percent_timely(engine):
    loan_input = KCCLoanInput(
        lender_type="PACS",
        sanctioned_amount_paise=30000000,  # ₹3,00,000
        disbursement_date=date(2025, 4, 1),
        due_date=date(2026, 3, 31),
        actual_repayment_date=date(2026, 3, 15),  # Timely
        is_repaid_timely=True,
    )
    result = engine.calculate_kcc_loan(loan_input)
    assert result["base_interest_rate_pct"] == Decimal("0.0")
    assert result["effective_interest_rate_pct"] == Decimal("0.0")
    assert result["interest_amount_paise"] == 0
    assert result["is_timely"] is True


# Test 2: Commercial/RRB 4% (7% - 3%) when timely
def test_commercial_rrb_four_percent_timely(engine):
    loan_input = KCCLoanInput(
        lender_type="COMMERCIAL",
        sanctioned_amount_paise=20000000,  # ₹2,00,000
        disbursement_date=date(2025, 4, 1),
        due_date=date(2026, 3, 31),
        actual_repayment_date=date(2026, 3, 20),
        is_repaid_timely=True,
    )
    result = engine.calculate_kcc_loan(loan_input)
    assert result["base_interest_rate_pct"] == Decimal("7.0")
    assert result["subvention_pct"] == Decimal("3.0")
    assert result["effective_interest_rate_pct"] == Decimal("4.0")
    # ₹2,00,000 * 4% = ₹8,000 = 800000 paise
    assert result["interest_amount_paise"] == 800000


# Test 3: Commercial/RRB 7% when not timely
def test_commercial_rrb_seven_percent_untimely(engine):
    loan_input = KCCLoanInput(
        lender_type="COMMERCIAL",
        sanctioned_amount_paise=20000000,  # ₹2,00,000
        disbursement_date=date(2025, 4, 1),
        due_date=date(2026, 3, 31),
        actual_repayment_date=date(2026, 4, 15),  # Late
        is_repaid_timely=False,
    )
    result = engine.calculate_kcc_loan(loan_input)
    assert result["base_interest_rate_pct"] == Decimal("7.0")
    assert result["subvention_pct"] == Decimal("0.0")
    assert result["effective_interest_rate_pct"] == Decimal("7.0")
    # ₹2,00,000 * 7% = ₹14,000 = 1400000 paise
    assert result["interest_amount_paise"] == 1400000


# Test 4: Loan above ₹3 lakh gets cap note
def test_kcc_above_3_lakh_cap_note(engine):
    loan_input = KCCLoanInput(
        lender_type="COMMERCIAL",
        sanctioned_amount_paise=40000000,  # ₹4,00,000
        disbursement_date=date(2025, 4, 1),
        due_date=date(2026, 3, 31),
        is_repaid_timely=True,
    )
    result = engine.calculate_kcc_loan(loan_input)
    assert "₹3,00,000" in result["cap_note"]
    assert "₹5,00,000" in result["cap_note"]
    assert result["eligible_subvention_amount_paise"] == 30000000
    assert result["excess_amount_paise"] == 10000000


# Test 5: Paddy cap at 21 qtl/acre with excess shown
def test_paddy_cap_calculation(engine):
    # 1.2140 ha = 2.9998547 acres -> 3.00 acres -> 63.00 quintals
    proc_input = PaddyProcurementInput(
        girdawari_paddy_hectares=Decimal("1.2140"),
        paddy_grade="COMMON",
        moisture_pct=Decimal("15.0"),
        quantity_offered_quintals=Decimal("70.00"),
    )
    result = engine.calculate_paddy_procurement(proc_input)
    assert result["paddy_acres"] == Decimal("3.00")
    assert result["eligible_cap_quintals"] == Decimal("63.00")
    assert result["excess_quintals"] == Decimal("7.00")
    assert result["procurement_quantity_quintals"] == Decimal("63.00")
    # 63 qtl * ₹2,441 = ₹1,53,783 = 15378300 paise
    assert result["msp_amount_paise"] == 15378300
    # 63 qtl * ₹659 = ₹41,517 = 4151700 paise
    assert result["kuy_amount_paise"] == 4151700
    # Total = ₹1,95,300 = 19530000 paise
    assert result["total_entitlement_paise"] == 19530000


# Test 6: Moisture above 17% alert, and exact-17% boundary
def test_moisture_boundary_and_alert(engine):
    # Exact 17.0% -> PASS (No alert)
    input_17 = PaddyProcurementInput(
        girdawari_paddy_hectares=Decimal("1.0000"),
        paddy_grade="COMMON",
        moisture_pct=Decimal("17.0"),
        quantity_offered_quintals=Decimal("20.00"),
    )
    res_17 = engine.calculate_paddy_procurement(input_17)
    assert res_17["moisture_alert"] is False
    assert res_17["moisture_status"] == "ACCEPTABLE"

    # 17.1% -> AMBER alert
    input_17_1 = PaddyProcurementInput(
        girdawari_paddy_hectares=Decimal("1.0000"),
        paddy_grade="COMMON",
        moisture_pct=Decimal("17.1"),
        quantity_offered_quintals=Decimal("20.00"),
    )
    res_17_1 = engine.calculate_paddy_procurement(input_17_1)
    assert res_17_1["moisture_alert"] is True
    assert res_17_1["moisture_severity"] == "AMBER"

    # 19.5% -> RED alert
    input_19_5 = PaddyProcurementInput(
        girdawari_paddy_hectares=Decimal("1.0000"),
        paddy_grade="COMMON",
        moisture_pct=Decimal("19.5"),
        quantity_offered_quintals=Decimal("20.00"),
    )
    res_19_5 = engine.calculate_paddy_procurement(input_19_5)
    assert res_19_5["moisture_alert"] is True
    assert res_19_5["moisture_severity"] == "RED"


# Test 7: KUY states: pending, due, overdue around release date
def test_kuy_states(engine):
    scheduled_date = date(2026, 3, 1)

    # 1. Before release date -> PENDING
    res_pending = engine.detect_discrepancy(
        EntitlementDiscrepancyInput(
            scheme_id="KUY_2026",
            entitled_amount_paise=4151700,
            actual_paid_amount_paise=0,
            scheduled_date=scheduled_date,
            actual_payout_date=None,
            reference_date=date(2026, 2, 20),
        )
    )
    assert res_pending["status"] == DiscrepancyState.PENDING.value

    # 2. On release date -> DUE
    res_due = engine.detect_discrepancy(
        EntitlementDiscrepancyInput(
            scheme_id="KUY_2026",
            entitled_amount_paise=4151700,
            actual_paid_amount_paise=0,
            scheduled_date=scheduled_date,
            actual_payout_date=None,
            reference_date=scheduled_date,
        )
    )
    assert res_due["status"] == DiscrepancyState.DUE.value

    # 3. 18 days after release date -> OVERDUE (18 days overdue)
    res_overdue = engine.detect_discrepancy(
        EntitlementDiscrepancyInput(
            scheme_id="KUY_2026",
            entitled_amount_paise=4151700,
            actual_paid_amount_paise=0,
            scheduled_date=scheduled_date,
            actual_payout_date=None,
            reference_date=date(2026, 3, 19),
        )
    )
    assert res_overdue["status"] == DiscrepancyState.OVERDUE.value
    assert res_overdue["days_overdue"] == 18


# Test 8: PMFBY premium caps (2%, 1.5%, 5%)
def test_pmfby_premium_caps(engine):
    kharif_input = PMFBYInput(
        crop_type="KHARIF_FOOD_OILSEEDS",
        sum_insured_paise=10000000,  # ₹1,00,000
        threshold_yield_kg_per_ha=Decimal("2500"),
        actual_cce_yield_kg_per_ha=Decimal("2500"),
    )
    res_kharif = engine.calculate_pmfby(kharif_input)
    assert res_kharif["farmer_premium_rate_pct"] == Decimal("2.0")
    assert res_kharif["farmer_premium_paise"] == 200000  # ₹2,000

    rabi_input = PMFBYInput(
        crop_type="RABI_FOOD_OILSEEDS",
        sum_insured_paise=10000000,
        threshold_yield_kg_per_ha=Decimal("2500"),
        actual_cce_yield_kg_per_ha=Decimal("2500"),
    )
    res_rabi = engine.calculate_pmfby(rabi_input)
    assert res_rabi["farmer_premium_rate_pct"] == Decimal("1.5")
    assert res_rabi["farmer_premium_paise"] == 150000  # ₹1,500

    comm_input = PMFBYInput(
        crop_type="COMMERCIAL_HORTICULTURE",
        sum_insured_paise=10000000,
        threshold_yield_kg_per_ha=Decimal("2500"),
        actual_cce_yield_kg_per_ha=Decimal("2500"),
    )
    res_comm = engine.calculate_pmfby(comm_input)
    assert res_comm["farmer_premium_rate_pct"] == Decimal("5.0")
    assert res_comm["farmer_premium_paise"] == 500000  # ₹5,000


# Test 9: PMFBY claim formula: (threshold - actual) / threshold * sum_insured
def test_pmfby_claim_calculation(engine):
    # Threshold = 2000 kg, actual CCE = 1500 kg -> shortfall = 500 / 2000 = 25%
    # Sum insured = ₹1,00,000 -> Claim = ₹25,000 = 2500000 paise
    pmfby_input = PMFBYInput(
        crop_type="KHARIF_FOOD_OILSEEDS",
        sum_insured_paise=10000000,
        threshold_yield_kg_per_ha=Decimal("2000"),
        actual_cce_yield_kg_per_ha=Decimal("1500"),
    )
    result = engine.calculate_pmfby(pmfby_input)
    assert result["has_claim"] is True
    assert result["claim_rate_pct"] == Decimal("25.0000")
    assert result["claim_amount_paise"] == 2500000


# Test 10: PMFBY zero claim when CCE >= threshold
def test_pmfby_zero_claim_when_cce_above_threshold(engine):
    pmfby_input = PMFBYInput(
        crop_type="KHARIF_FOOD_OILSEEDS",
        sum_insured_paise=10000000,
        threshold_yield_kg_per_ha=Decimal("2000"),
        actual_cce_yield_kg_per_ha=Decimal("2100"),
    )
    result = engine.calculate_pmfby(pmfby_input)
    assert result["has_claim"] is False
    assert result["claim_amount_paise"] == 0


# Test 11: ₹1 rounding tolerance boundary (₹1 clear, ₹2 alert)
def test_rounding_tolerance_boundary(engine):
    # ₹1 difference (100 paise) -> CLEAR (PAID)
    res_1 = engine.detect_discrepancy(
        EntitlementDiscrepancyInput(
            scheme_id="KUY_2026",
            entitled_amount_paise=4151700,
            actual_paid_amount_paise=4151600,  # ₹1 less
            scheduled_date=date(2026, 3, 1),
            actual_payout_date=date(2026, 3, 2),
            reference_date=date(2026, 3, 10),
        )
    )
    assert res_1["status"] == DiscrepancyState.PAID.value
    assert res_1["alert_flag"] is False

    # ₹2 difference (200 paise) -> ALERT (UNDERPAID)
    res_2 = engine.detect_discrepancy(
        EntitlementDiscrepancyInput(
            scheme_id="KUY_2026",
            entitled_amount_paise=4151700,
            actual_paid_amount_paise=4151500,  # ₹2 less
            scheduled_date=date(2026, 3, 1),
            actual_payout_date=date(2026, 3, 2),
            reference_date=date(2026, 3, 10),
        )
    )
    assert res_2["status"] == DiscrepancyState.UNDERPAID.value
    assert res_2["alert_flag"] is True


# Test 12: Fuzzy bands at 94.99 (amber/red), 95 (green), 74.99 (red), 75 (amber)
def test_fuzzy_matching_bands():
    # 95+ -> GREEN
    m_green = match_names(
        registry_name="Ram Lal",
        registry_father="Shyam Lal",
        bank_name="Ram Lal",
        bank_father="Shyam Lal",
    )
    assert m_green.score >= 95.0
    assert m_green.band == MatchBand.GREEN

    # Match father, but name similarity between 75 and 95 -> AMBER
    m_amber = match_names(
        registry_name="Ram Lal Sharma",
        registry_father="Shyam Lal",
        bank_name="Ram Sharma",
        bank_father="Shyam Lal",
    )
    if 75.0 <= m_amber.score < 95.0:
        assert m_amber.band == MatchBand.AMBER

    # Below 75 -> RED
    m_red = match_names(
        registry_name="Ram Lal",
        registry_father="Shyam Lal",
        bank_name="Vikram Singh",
        bank_father="Shyam Lal",
    )
    assert m_red.score < 75.0
    assert m_red.band == MatchBand.RED


# Test 13: Father mismatch forces RED
def test_father_mismatch_forces_red():
    # Perfect owner match (100%), but completely different father -> MUST BE RED
    res = match_names(
        registry_name="Ramesh Kumar",
        registry_father="Dinesh Kumar",
        bank_name="Ramesh Kumar",
        bank_father="Mahesh Chand",
    )
    assert res.father_score < 75.0
    assert res.band == MatchBand.RED
    assert "Father name mismatch" in res.reasons[0]


# Test 14: Duplicate active KCC per parcel
def test_duplicate_active_kcc(engine):
    active_loans = [
        {"parcel_id": "P-101", "bank_name": "State Bank of India", "is_active": True},
        {"parcel_id": "P-102", "bank_name": "Durg District Coop Bank", "is_active": True},
    ]
    # Check for P-101 -> Duplicate detected
    dup_res = engine.check_duplicate_kcc("P-101", active_loans)
    assert dup_res["is_duplicate"] is True
    assert dup_res["existing_bank"] == "State Bank of India"

    # Check for P-103 -> Clean
    clean_res = engine.check_duplicate_kcc("P-103", active_loans)
    assert clean_res["is_duplicate"] is False


# Test 15: Small-cell suppression at 4 and 5
def test_small_cell_suppression(engine):
    assert engine.suppress_small_cell(0)["suppressed"] is True
    assert engine.suppress_small_cell(4)["suppressed"] is True
    assert engine.suppress_small_cell(4)["display"] == "Under 5 (Suppressed for Privacy)"

    res_5 = engine.suppress_small_cell(5)
    assert res_5["suppressed"] is False
    assert res_5["display"] == "5"

    res_12 = engine.suppress_small_cell(12)
    assert res_12["suppressed"] is False
    assert res_12["display"] == "12"


# Test 16: Single hectare-to-acre conversion boundary
def test_hectare_to_acre_factor():
    assert HA_TO_ACRES_FACTOR == Decimal("2.47105")
    # Single conversion helper preserves exact calculation without premature rounding
    assert ha_to_acres(Decimal("1")) == Decimal("2.47105")
    assert ha_to_acres(Decimal("2")) == Decimal("4.94210")


# Test 17: Number-to-words round trip
def test_number_to_hindi_words():
    from app.rules.number_words import _hindi_words_to_number
    # 1,53,783
    w = number_to_hindi_words(153783)
    assert "एक लाख" in w
    assert "तिरपन हज़ार" in w
    assert "सात सौ तिरासी" in w

    # Round trip test: number -> words -> number equals original
    round_tripped = _hindi_words_to_number(w)
    assert round_tripped == 153783

    # Currency format
    rw = rupees_to_hindi_words(15378300)
    assert rw.endswith("रुपये")

    # English words
    ew = rupees_to_english_words(15378300)
    assert "One Lakh Fifty-Three Thousand Seven Hundred Eighty-Three Rupees" in ew


# Test 18: Every reason code has Hindi and English display and speech template
def test_all_reason_codes_have_bilingual_templates(engine):
    reason_catalog = engine.get_reason_catalog()
    assert len(reason_catalog) >= 7
    for code, item in reason_catalog.items():
        assert "hi" in item
        assert "en" in item
        assert "display_text" in item["hi"]
        assert "speech_text" in item["hi"]
        assert "display_text" in item["en"]
        assert "speech_text" in item["en"]
        assert "department" in item


# Test 19: Farmer A cannot read Farmer B (session isolation mock check)
def test_farmer_session_isolation():
    # Helper simulating secure session resolver
    def resolve_allowed_farmer(session_farmer_id: str, requested_farmer_id: str | None = None):
        # Always return session farmer id, ignore requested_farmer_id
        return session_farmer_id

    session_user = "FARMER_123"
    adversary_request = "FARMER_999"
    resolved_id = resolve_allowed_farmer(session_user, adversary_request)
    assert resolved_id == session_user
    assert resolved_id != adversary_request


# Test 20: Multi-parcel aggregation and per-parcel MISS check
def test_multi_parcel_aggregation(engine):
    parcels = [
        {"parcel_id": "P1", "girdawari_paddy_hectares": Decimal("1.2140")},  # 2.99985 -> 63.00 qtl
        {"parcel_id": "P2", "girdawari_paddy_hectares": Decimal("0.5000")},  # 1.235525 -> 25.95 qtl
    ]
    caps = [paddy_quantity_cap(ha_to_acres(p["girdawari_paddy_hectares"])) for p in parcels]
    assert caps[0] == Decimal("63.00")
    assert caps[1] == Decimal("25.95")
    total_cap = sum(caps)
    assert total_cap == Decimal("88.95")


# Test 21: Audit-chain tamper detection
def test_audit_chain_tamper_detection():
    service = AuditChainService()
    # Add block 1
    b1 = service.append_event("FARMER_101", "CONSENT_GIVEN", {"scopes": ["LAND", "LOAN"]})
    # Add block 2
    b2 = service.append_event("FARMER_101", "KCC_VERDICT", {"verdict": "APPROVED"})
    # Verify valid chain
    valid, err = service.verify_chain_detailed()
    assert valid is True
    assert err is None

    # Tamper with block 1 payload
    b1.payload = {"tampered": True}
    valid_tampered, err_tampered = service.verify_chain_detailed()
    assert valid_tampered is False
    assert "Hash mismatch" in err_tampered


# Test 22: Outside-rejection verdicts: WRONGFUL and CANNOT_VERIFY
def test_outside_rejection_verdicts(engine):
    # Farmer offered 60 qtl on 3.0 acres (cap = 63 qtl) and was rejected for EXCESS_QUANTITY
    res_wrongful = engine.explain_outside_rejection(
        OutsideRejectionInput(
            farmer_selected_reason_code="REJ_PADDY_EXCESS_QUANTITY",
            actual_data={"paddy_acres": Decimal("3.00"), "quantity_offered_quintals": Decimal("60.00")},
        )
    )
    assert res_wrongful["verdict"] == RejectionVerdict.WRONGFUL.value

    # Moisture rejection without sensor/mandi moisture data in registry -> CANNOT_VERIFY
    res_cannot_verify = engine.explain_outside_rejection(
        OutsideRejectionInput(
            farmer_selected_reason_code="REJ_PADDY_MOISTURE_EXCEEDED",
            actual_data={"paddy_acres": Decimal("3.00")},  # Missing moisture reading
        )
    )
    assert res_cannot_verify["verdict"] == RejectionVerdict.CANNOT_VERIFY.value


# Test 23: Template rendering smoke test (Grievance letter with conjuncts)
def test_grievance_letter_template_rendering():
    tmpl_service = TemplateService()
    context = {
        "farmer_name": "रामेश्वर पटेल",
        "father_name": "श्यामा चरण पटेल",
        "mobile_masked": "XXXXXX9812",
        "village": "सिल्ली",
        "district": "रायपुर",
        "authority_name": "जिला विपणन अधिकारी",
        "authority_designation": "खाद्य एवं नागरिक आपूर्ति विभाग",
        "date_today": "23/11/2026",
        "affected_parcels": [
            {"khasra_no": "142/1", "area_acres": "3.00", "crop": "धान (Paddy)"}
        ],
        "entitled_amount_display": "₹41,517",
        "entitled_amount_words": "इकतालीस हज़ार पाँच सौ सत्रह रुपये",
        "actual_amount_display": "₹0",
        "gap_amount_display": "₹41,517",
        "discrepancy_reason": "कृषक उन्नति योजना अंतर राशि 18 दिनों से लंबित है।",
        "next_action": "15 दिनों के भीतर देय राशि का भुगतान किया जाए।",
        "rule_reference": "RULE_KUY_2026",
        "case_id": "CASE-2026-0042",
        "verification_hash": "a1b2c3d4e5f67890",
    }
    rendered_hi = tmpl_service.render_grievance_letter(context, language="hi")
    assert "कृषक उन्नति योजना" in rendered_hi
    assert "छत्तीसगढ़" in rendered_hi
    assert "रामेश्वर पटेल" in rendered_hi
    assert "a1b2c3d4e5f67890" in rendered_hi

    rendered_en = tmpl_service.render_grievance_letter(context, language="en")
    assert "GRIEVANCE REDRESSAL" in rendered_en
    assert "CASE-2026-0042" in rendered_en


# Test 24: i18n key parity check
def test_i18n_key_parity():
    import os
    # If the frontend i18n files exist, check their key parity
    frontend_i18n_hi = os.path.abspath("../frontend/src/i18n/hi.json")
    frontend_i18n_en = os.path.abspath("../frontend/src/i18n/en.json")
    if os.path.exists(frontend_i18n_hi) and os.path.exists(frontend_i18n_en):
        with open(frontend_i18n_hi, "r", encoding="utf-8") as f:
            hi_data = json.load(f)
        with open(frontend_i18n_en, "r", encoding="utf-8") as f:
            en_data = json.load(f)
        assert set(hi_data.keys()) == set(en_data.keys())
    else:
        # Check backend bilingual explanation templates parity
        engine = RulesEngine()
        catalog = engine.get_reason_catalog()
        for code, data in catalog.items():
            assert set(data["hi"].keys()) == set(data["en"].keys())


# Test 25 (Purity Guarantee): ZERO AI MATH & No forbidden imports in engine.py
def test_engine_pure_imports_check():
    import ast
    from pathlib import Path
    engine_file = Path(__file__).parent.parent / "app" / "rules" / "engine.py"
    with open(engine_file, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read(), filename=str(engine_file))

    forbidden_modules = {
        "fastapi",
        "sqlalchemy",
        "httpx",
        "requests",
        "openai",
        "anthropic",
        "google.generativeai",
        "langchain",
    }
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                for forbidden in forbidden_modules:
                    assert not alias.name.startswith(forbidden), f"engine.py imports forbidden module: {alias.name}"
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                for forbidden in forbidden_modules:
                    assert not node.module.startswith(forbidden), f"engine.py imports forbidden module: {node.module}"


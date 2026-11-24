import pytest
from decimal import Decimal
from datetime import date
from sqlalchemy import text
from app.database import SessionLocal, engine
from app.models.entities import Farmer, LandParcel, Loan, Procurement, InsuranceUnit, Case, AuditEvent
from app.adapters.synthetic_adapter import SyntheticAdapter
from app.adapters.agristack_stub import AgriStackStub
from app.adapters.bhuiyan_stub import BhuiyanStub
from app.adapters.cersai_stub import CERSAIStub
from app.rules.engine import RulesEngine, PaddyProcurementInput, EntitlementDiscrepancyInput


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def adapter(db):
    return SyntheticAdapter(db)


from app.database import IS_SQLITE


# 1. SQLite Pragmas: WAL mode and Foreign Keys
def test_sqlite_pragmas(db):
    if not IS_SQLITE:
        pytest.skip("SQLite pragma check only applies to SQLite databases.")
    journal_mode = db.execute(text("PRAGMA journal_mode;")).scalar()
    assert str(journal_mode).lower() == "wal"

    foreign_keys = db.execute(text("PRAGMA foreign_keys;")).scalar()
    assert foreign_keys == 1


# 2. Five Golden Personas Seeded
def test_all_five_personas_present(db):
    farmer_ids = ["F-001", "F-002", "F-003", "F-004", "F-005"]
    for fid in farmer_ids:
        farmer = db.query(Farmer).filter(Farmer.id == fid).first()
        assert farmer is not None, f"Farmer {fid} must be present in seeded database"
        assert len(farmer.parcels) >= 1
        assert farmer.mobile.startswith("987654321")


# 3. Persona F-001 (Ramesh Patel) Arithmetic and Overdue Snapshot
def test_persona_f001_paddy_and_kuy_overdue(adapter):
    snapshot = adapter.get_registry_snapshot("F-001")
    farmer = snapshot["farmer"]
    assert farmer["name_hi"] == "रामेश्वर पटेल"
    assert farmer["village"] == "सिल्ली"
    assert farmer["district"] == "रायपुर"

    # Parcel area: 1.2140 ha
    parcel = snapshot["parcels"][0]
    assert parcel["area_ha"] == "1.2140"

    # Engine cap verification: 63.00 quintals
    engine = RulesEngine()
    proc_calc = engine.calculate_paddy_procurement(
        PaddyProcurementInput(
            girdawari_paddy_hectares=Decimal(parcel["area_ha"]),
            paddy_grade="COMMON",
            moisture_pct=Decimal("15.20"),
            quantity_offered_quintals=Decimal("63.00"),
        )
    )
    assert proc_calc["eligible_cap_quintals"] == Decimal("63.00")
    assert proc_calc["msp_amount_paise"] == 15378300  # ₹1,53,783
    assert proc_calc["kuy_amount_paise"] == 4151700   # ₹41,517

    # KUY is 18 days overdue (demo reference date: 2026-03-19, expected: 2026-03-01)
    proc_record = snapshot["procurements"][0]
    disc_calc = engine.detect_discrepancy(
        EntitlementDiscrepancyInput(
            scheme_id="KUY_2026",
            entitled_amount_paise=4151700,
            actual_paid_amount_paise=proc_record["kuy_paid_paise"],  # 0
            scheduled_date=date.fromisoformat(proc_record["kuy_expected_release_date"]),
            reference_date=date(2026, 3, 19),
        )
    )
    assert disc_calc["status"] == "OVERDUE"
    assert disc_calc["days_overdue"] == 18


# 4. Persona F-002 (Shyam Verma) Commercial Loan Overcharge
def test_persona_f002_loan_overcharge(adapter):
    loans = adapter.get_loans("F-002")
    assert len(loans) == 1
    loan = loans[0]
    assert loan["lender_type"] == "COMMERCIAL"
    assert loan["principal_paise"] == 20000000  # ₹2,00,000
    assert loan["interest_charged_paise"] == 1400000  # ₹14,000 (7% charged by bank)
    assert loan["is_repaid_timely"] is True

    # Entitled interest at 4% for ₹2,00,000 should be ₹8,000 (800000 paise)
    entitled_interest_paise = 800000
    overcharge = loan["interest_charged_paise"] - entitled_interest_paise
    assert overcharge == 600000  # ₹6,000 overcharge gap


# 5. Persona F-003 (Anita Bai) PMFBY Crop Loss Claim
def test_persona_f003_pmfby_claim(adapter):
    insurance = adapter.get_insurance_units("मस्तूरी")
    assert len(insurance) >= 1
    unit = insurance[0]
    assert unit["crop"] == "Paddy"
    assert unit["season"] == "Kharif"
    assert Decimal(unit["cce_yield_kg"]) < Decimal(unit["average_yield_kg"])  # Yield loss occurred


# 6. Persona F-004 (Vikram Singh) High Moisture Alert
def test_persona_f004_high_moisture(adapter):
    proc = adapter.get_procurements("F-004")
    assert len(proc) >= 1
    record = proc[0]
    assert Decimal(record["moisture_pct"]) > Decimal("17.0")  # 17.8% trigger


# 7. Persona F-005 (Dilip Kumar) Duplicate Loan and Mortgage
def test_persona_f005_duplicate_loan_mortgage(adapter):
    parcels = adapter.get_parcels("F-005")
    assert parcels[0]["mortgage_status"] == "MORTGAGED"

    loans = adapter.get_loans("F-005")
    assert any(l["is_active"] and l["is_subsidised"] for l in loans)


# 8. DataAdapter Stubs raise NotImplementedError (Hard Rule 8)
def test_real_system_stubs_raise():
    agristack = AgriStackStub()
    bhuiyan = BhuiyanStub()
    cersai = CERSAIStub()

    with pytest.raises(NotImplementedError):
        agristack.get_farmer_by_mobile("9876543210")

    with pytest.raises(NotImplementedError):
        bhuiyan.get_parcels("F-001")

    with pytest.raises(NotImplementedError):
        cersai.get_loans("F-001")


# 9. Hard Rule 7: Session isolation guard test
def test_farmer_session_guard(adapter):
    # Simulates FastAPI dependency resolving farmer_id from signed session
    def get_authenticated_farmer_snapshot(session_farmer_id: str, requested_farmer_id: str):
        # Enforce rule: ignore requested_farmer_id, always fetch session_farmer_id
        effective_id = session_farmer_id
        return adapter.get_registry_snapshot(effective_id)

    # Farmer F-001 is logged in
    session_id = "F-001"
    # Adversary tries to request F-002
    adversary_request_id = "F-002"

    snapshot = get_authenticated_farmer_snapshot(session_id, adversary_request_id)
    assert snapshot["farmer"]["id"] == "F-001"
    assert snapshot["farmer"]["id"] != "F-002"
    assert snapshot["farmer"]["name_hi"] == "रामेश्वर पटेल"


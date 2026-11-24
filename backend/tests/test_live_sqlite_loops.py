"""
Test the Two Live SQLite Loops on Farmer Side:
1. Scheme Eligibility -> Gaps & Cases (Applied Schemes + Payout Discrepancy Check + Grievance Cases)
2. Bank Officer Console (/bank) -> Farmer 'My Loans & Applications' (Live Approved / Rejected Decisions)
"""
import pytest
from datetime import date
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.entities import Farmer, LandParcel, BankApplication, Loan, Rejection, FarmerSchemeApplication, Case


@pytest.fixture
def client():
    return TestClient(app)


def test_loop_1_scheme_application_and_discrepancy(client):
    # 1. Login as demo farmer (Ramesh Patel F-001) via Khasra + Phone + Password
    khasra_res = client.post("/api/v1/auth/login-khasra", json={"khasra_no": "142/1", "phone": "9876543210", "password": "Kisan@2026"})
    assert khasra_res.status_code == 200

    # 2. Apply for an eligible scheme in Scheme Eligibility tab
    apply_res = client.post(
        "/api/v1/farmer/schemes/apply",
        json={
            "scheme_code": "RULE_KUY_PADDY",
            "scheme_name": "Krishak Unnati Yojana (धान इनपुट सहायता)",
            "entitled_paise": 2849600,
            "official_portal_url": "https://kisan.cg.nic.in",
            "expected_release_date": "2026-12-15",
        }
    )
    assert apply_res.status_code == 200
    applied_data = apply_res.json()
    assert applied_data["status"] == "APPLIED"
    app_record = applied_data["application"]
    assert app_record["scheme_code"] == "RULE_KUY_PADDY"
    app_id = app_record["id"]

    # 3. Section A: Query Applied Schemes & Payout Discrepancy Check
    get_res = client.get("/api/v1/farmer/applied-schemes")
    assert get_res.status_code == 200
    schemes_list = get_res.json()["applied_schemes"]
    assert len(schemes_list) >= 1
    kuy_item = next((s for s in schemes_list if s["id"] == app_id), None)
    assert kuy_item is not None
    assert kuy_item["entitled_paise"] == 2849600

    # 4. Interactive 'Amount Actually Received' update -> Underpaid (Red badge)
    patch_underpaid = client.patch(
        f"/api/v1/farmer/applied-schemes/{app_id}/received",
        json={"actual_received_paise": 1500000}  # Received ₹15,000 out of ₹28,496
    )
    assert patch_underpaid.status_code == 200
    underpaid_res = patch_underpaid.json()
    assert underpaid_res["discrepancy_verdict"] == "DISCREPANCY_DETECTED"
    assert underpaid_res["badge_color"] == "RED"
    assert underpaid_res["gap_paise"] == 1349600
    assert len(underpaid_res["rule_steps"]) == 3

    # 5. Interactive update -> Full amount received (Green badge)
    patch_full = client.patch(
        f"/api/v1/farmer/applied-schemes/{app_id}/received",
        json={"actual_received_paise": 2849600}
    )
    assert patch_full.status_code == 200
    full_res = patch_full.json()
    assert full_res["discrepancy_verdict"] == "NO_DISCREPANCY"
    assert full_res["badge_color"] == "GREEN"
    assert full_res["gap_paise"] == 0

    # 6. Section B: Create Grievance Case and progress timeline
    case_res = client.post(
        "/api/v1/farmer/cases",
        json={
            "authority_name": "District Procurement Officer / Markfed",
            "authority_designation": "District Supply Division",
            "scheme_id": "RULE_KUY_PADDY",
            "entitled_paise": 2849600,
            "actual_paise": 1500000,
            "gap_paise": 1349600,
            "details": "Test grievance for Krishak Unnati Yojana input assistance deficit."
        }
    )
    assert case_res.status_code == 200
    case_data = case_res.json()
    case_id = case_data["id"]
    assert case_data["status"] in ("DETECTED", "LETTER_GENERATED")

    # 7. Update timeline: DETECTED/LETTER_GENERATED -> FILED -> RESOLVED
    filed_res = client.patch(
        f"/api/v1/farmer/cases/{case_id}/status",
        json={"new_status": "FILED"}
    )
    assert filed_res.status_code == 200
    assert filed_res.json()["status"] == "FILED"

    resolved_res = client.patch(
        f"/api/v1/farmer/cases/{case_id}/status",
        json={"new_status": "RESOLVED"}
    )
    assert resolved_res.status_code == 200
    assert resolved_res.json()["status"] == "RESOLVED"


def test_section_a_resolve_and_move_to_section_b(client):
    # Setup: Clean any prior test records
    db = SessionLocal()
    try:
        db.query(FarmerSchemeApplication).filter(FarmerSchemeApplication.scheme_code.like("RULE_TEST_%")).delete()
        db.commit()
    finally:
        db.close()

    # 1. Login as demo farmer (Ramesh Patel F-001)
    client.post("/api/v1/auth/login-khasra", json={"khasra_no": "142/1", "phone": "9876543210", "password": "Kisan@2026"})

    # 2. Apply for two schemes
    apply_res1 = client.post(
        "/api/v1/farmer/schemes/apply",
        json={
            "scheme_code": "RULE_TEST_RESOLVE",
            "scheme_name": "Test Resolve Scheme",
            "entitled_paise": 1000000,
            "expected_release_date": "2026-12-01",
        }
    )
    assert apply_res1.status_code == 200
    app_id1 = apply_res1.json()["application"]["id"]

    apply_res2 = client.post(
        "/api/v1/farmer/schemes/apply",
        json={
            "scheme_code": "RULE_TEST_GRIEVANCE",
            "scheme_name": "Test Grievance Scheme",
            "entitled_paise": 2000000,
            "expected_release_date": "2026-12-01",
        }
    )
    assert apply_res2.status_code == 200
    app_id2 = apply_res2.json()["application"]["id"]

    # Both are in Section A
    schemes_res = client.get("/api/v1/farmer/applied-schemes")
    assert schemes_res.status_code == 200
    ids_in_a = [s["id"] for s in schemes_res.json()["applied_schemes"]]
    assert app_id1 in ids_in_a
    assert app_id2 in ids_in_a

    # 3. Scheme 1: Click "Money Received Successfully" -> Removed from Section A
    resolve_res = client.post(f"/api/v1/farmer/applied-schemes/{app_id1}/resolve")
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "COMPLETED"

    schemes_after_resolve = client.get("/api/v1/farmer/applied-schemes").json()["applied_schemes"]
    assert app_id1 not in [s["id"] for s in schemes_after_resolve]

    # 4. Scheme 2: Enter partial money and click "Move to Section B Grievance"
    client.patch(
        f"/api/v1/farmer/applied-schemes/{app_id2}/received",
        json={"actual_received_paise": 500000}
    )
    move_res = client.post(f"/api/v1/farmer/applied-schemes/{app_id2}/move-to-grievance")
    assert move_res.status_code == 200
    move_body = move_res.json()
    assert move_body["status"] == "MOVED_TO_GRIEVANCE"
    new_case_id = move_body["case_id"]

    # Scheme 2 is now removed from Section A
    schemes_after_move = client.get("/api/v1/farmer/applied-schemes").json()["applied_schemes"]
    assert app_id2 not in [s["id"] for s in schemes_after_move]

    # Scheme 2 is now in Section B (Grievance Cases)
    cases_res = client.get("/api/v1/farmer/cases")
    assert cases_res.status_code == 200
    case_ids = [c["id"] for c in cases_res.json()]
    assert new_case_id in case_ids


def test_loop_2_bank_officer_decisions_to_farmer_loans(client):
    # Setup/Cleanup prior test artifacts
    db = SessionLocal()
    try:
        db.query(BankApplication).filter(BankApplication.id.in_(["APP-TEST-APPROVE-1", "APP-TEST-REJECT-2"])).delete()
        db.query(Rejection).filter(Rejection.application_id == "APP-TEST-REJECT-2").delete()
        db.query(Loan).filter(Loan.id.like("LOAN-APP-TEST-APPROVE-1%")).delete()
        db.commit()
    finally:
        db.close()

    # 1. Login as Bank Officer (Anita Verma)
    bank_login = client.post(
        "/api/v1/auth/bank/login",
        json={"identifier": "EMP-2041", "password": "Password@123"}
    )
    assert bank_login.status_code == 200

    # 2. Bank Officer submits APPROVE on an application
    approve_res = client.post(
        "/api/v1/bank/verdict",
        json={
            "application_id": "APP-TEST-APPROVE-1",
            "khasra_no": "142/1",
            "parcel_id": "P-101",
            "applicant_name": "Ramesh Patel",
            "decision": "APPROVE",
            "flags": [],
            "officer_notes": "All Bhuiyan land records and KCC limits verified.",
        }
    )
    assert approve_res.status_code == 200
    approve_body = approve_res.json()
    assert approve_body["status"] in ("APPROVE", "APPROVED")
    assert "receipt_hash" in approve_body

    # 3. Bank Officer submits REJECT on another application with duplicate KCC flag
    reject_res = client.post(
        "/api/v1/bank/verdict",
        json={
            "application_id": "APP-TEST-REJECT-2",
            "khasra_no": "142/1",
            "parcel_id": "P-101",
            "applicant_name": "Ramesh Patel",
            "decision": "REJECT",
            "flags": ["DUPLICATE_KCC_DETECTED", "ACTIVE_LOAN_DCCB"],
            "officer_notes": "Active loan exists with DCCB on Khasra 142/1. NOC required.",
        }
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] in ("REJECT", "REJECTED")

    # 4. Now Farmer logs in
    farmer_login = client.post("/api/v1/auth/login-khasra", json={"khasra_no": "142/1", "phone": "9876543210", "password": "Kisan@2026"})
    assert farmer_login.status_code == 200

    # 5. Farmer views 'My Loans & Applications'
    loans_res = client.get("/api/v1/farmer/loans-and-decisions")
    assert loans_res.status_code == 200
    data = loans_res.json()

    # Verify Bank Decisions
    decisions = data["bank_decisions"]
    approved_dec = next((d for d in decisions if d["application_id"] == "APP-TEST-APPROVE-1"), None)
    assert approved_dec is not None
    assert approved_dec["decision"] == "APPROVED"
    assert approved_dec["audit_hash"] is not None
    assert "Approved by Bank Officer" in approved_dec["message_en"]

    rejected_dec = next((d for d in decisions if d["application_id"] == "APP-TEST-REJECT-2"), None)
    assert rejected_dec is not None
    assert rejected_dec["decision"] in ("REJECT", "REJECTED")
    assert rejected_dec["audit_hash"] is not None
    assert rejected_dec["can_dispute"] is True
    # Reason and Next Steps should be populated in plain language
    assert "सक्रिय" in rejected_dec["reason_hi"] or "KCC" in rejected_dec["reason_en"]
    assert "NOC" in rejected_dec["next_steps_en"] or "अनापत्ति" in rejected_dec["next_steps_hi"]

    # Verify Existing Loans
    existing_loans = data["loans"]
    assert len(existing_loans) >= 1
    for loan in existing_loans:
        assert "principal_display" in loan
        assert "effective_rate_pct" in loan
        assert "entitled_rate_pct" in loan

    # Teardown
    db = SessionLocal()
    try:
        db.query(BankApplication).filter(BankApplication.id.in_(["APP-TEST-APPROVE-1", "APP-TEST-REJECT-2"])).delete()
        db.query(Rejection).filter(Rejection.application_id == "APP-TEST-REJECT-2").delete()
        db.query(Loan).filter(Loan.id.like("LOAN-APP-TEST-APPROVE-1%")).delete()
        db.commit()
    finally:
        db.close()

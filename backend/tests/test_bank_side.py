"""
Tests for Bank Officer Console: Staff Auth, SQLite Synthetic Registry,
Interactive Cross-Verification, and SHA-256 Audit Chain Verification.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth import SESSION_COOKIE_NAME

client = TestClient(app)


def test_bank_officer_register_and_login():
    # 1. Register new staff officer with unique employee ID
    uid = uuid.uuid4().hex[:6].upper()
    emp_id = f"CGGB-{uid}"
    email = f"kavita.{uid.lower()}@cggb.in"
    reg_payload = {
        "full_name": "Kavita Sahu",
        "email": email,
        "employee_id": emp_id,
        "bank_name": "Chhattisgarh Rajya Gramin Bank",
        "branch_district": "Dhamtari",
        "password": "SecurePassword@123",
    }
    res_reg = client.post("/api/v1/auth/bank/register", json=reg_payload)
    assert res_reg.status_code == 200, res_reg.text
    data_reg = res_reg.json()
    assert data_reg["officer"]["employee_id"] == emp_id
    assert "session_token" in data_reg
    assert SESSION_COOKIE_NAME in res_reg.cookies

    # 2. Login with Employee ID
    res_login_emp = client.post(
        "/api/v1/auth/bank/login",
        json={"identifier": emp_id, "password": "SecurePassword@123"}
    )
    assert res_login_emp.status_code == 200
    assert res_login_emp.json()["officer"]["full_name"] == "Kavita Sahu"

    # 3. Login with Email
    res_login_email = client.post(
        "/api/v1/auth/bank/login",
        json={"identifier": email, "password": "SecurePassword@123"}
    )
    assert res_login_email.status_code == 200

    # 4. Check Demo Officer seeded (Anita Verma)
    res_demo = client.post(
        "/api/v1/auth/bank/login",
        json={"identifier": "EMP-2041", "password": "Password@123"}
    )
    assert res_demo.status_code == 200
    assert res_demo.json()["officer"]["full_name"] == "Anita Verma"


def test_bank_locations_and_registry_browser():
    # 1. Locations hierarchy
    res_loc = client.get("/api/v1/bank/locations")
    assert res_loc.status_code == 200
    loc_data = res_loc.json()
    assert "रायपुर" in loc_data["districts"]
    assert "आरंग" in loc_data["hierarchy"]["रायपुर"]
    assert "सिल्ली" in loc_data["hierarchy"]["रायपुर"]["आरंग"]

    # 2. Registry Browser (50+ records)
    res_reg = client.get("/api/v1/bank/registry")
    assert res_reg.status_code == 200
    reg_data = res_reg.json()
    assert reg_data["total"] >= 50

    # Search for specific Khasra 1087/2
    res_search = client.get("/api/v1/bank/registry?search=1087/2")
    assert res_search.status_code == 200
    assert len(res_search.json()["records"]) >= 1
    rec = res_search.json()["records"][0]
    assert rec["khasra_no"] == "1087/2"
    assert rec["farmer_name_hi"] == "रमेश साहू"
    assert rec["mortgage_status"] == "ACTIVE"


def test_interactive_verification_clean_amber_red_cases():
    # ── Case 1: Clean Case (GREEN) ───────────────────────────────────
    # Ramesh Patel s/o Shyama Charan Patel on Khasra 142/1, Silli, Arang, Raipur
    clean_req = {
        "district": "रायपुर",
        "tehsil": "आरंग",
        "village": "सिल्ली",
        "khasra_no": "142/1",
        "applicant_name": "Ramesh Patel",
        "applicant_father": "Shyama Charan Patel",
        "requested_amount_rupees": 150000.0,
        "loan_type": "KCC",
    }
    res_clean = client.post("/api/v1/bank/interactive-verify", json=clean_req)
    assert res_clean.status_code == 200, res_clean.text
    clean_data = res_clean.json()
    assert clean_data["verdict"] == "GREEN"
    assert clean_data["name_score"] >= 95.0
    assert clean_data["father_score"] >= 90.0
    assert not clean_data["collateral_required"]  # <= ₹2L

    # ── Case 2: Amber Case (AMBER) ───────────────────────────────────
    # Vikram Sinh s/o Balwant Singh on Khasra 45/2, Dongargaon, Rajnandgaon
    # Registry has "Vikram Singh" -> minor spelling drift
    amber_req = {
        "district": "राजनांदगांव",
        "tehsil": "डोंगरगांव",
        "village": "डोंगरगांव",
        "khasra_no": "45/2",
        "applicant_name": "Vikram Sinh",
        "applicant_father": "Balwant Singh",
        "requested_amount_rupees": 160000.0,
        "loan_type": "KCC",
    }
    res_amber = client.post("/api/v1/bank/interactive-verify", json=amber_req)
    assert res_amber.status_code == 200, res_amber.text
    amber_data = res_amber.json()
    assert amber_data["verdict"] == "AMBER"
    assert 75.0 <= amber_data["name_score"] < 95.0
    assert amber_data["father_score"] >= 85.0
    amber_flags = [f["id"] for f in amber_data["flags"]]
    assert "FLAG-ID-SPELLING" in amber_flags

    # ── Case 3: Red Case (RED) ───────────────────────────────────────
    # Testing applicant "Rakesh Sahu" s/o "Ganesh Sahu" on Raipur Khasra 1087/2
    # Owned by "Ramesh Sahu" s/o "Mohan Sahu" with ACTIVE KCC ₹1,80,000 at Raipur District Cooperative Bank
    # Requesting ₹2,50,000 KCC -> Identity Mismatch + Duplicate Active KCC + Collateral Required
    red_req = {
        "district": "रायपुर",
        "tehsil": "आरंग",
        "village": "मंदिर हसौद",
        "khasra_no": "1087/2",
        "applicant_name": "Rakesh Sahu",
        "applicant_father": "Ganesh Sahu",
        "requested_amount_rupees": 250000.0,
        "loan_type": "KCC",
    }
    res_red = client.post("/api/v1/bank/interactive-verify", json=red_req)
    assert res_red.status_code == 200, res_red.text
    red_data = res_red.json()
    assert red_data["verdict"] == "RED"
    assert red_data["father_score"] < 85.0
    assert red_data["collateral_required"] is True  # > ₹2L

    red_flag_ids = [f["id"] for f in red_data["flags"]]
    assert "FLAG-ID-MISMATCH" in red_flag_ids
    assert "FLAG-DUP-KCC" in red_flag_ids
    assert "FLAG-MORTGAGE-ACTIVE" in red_flag_ids


def test_verdict_audit_chain_and_rejection_record():
    # Login as Anita Verma
    login = client.post(
        "/api/v1/auth/bank/login",
        json={"identifier": "EMP-2041", "password": "Password@123"}
    )
    token = login.json()["session_token"]

    # Submit RED rejection verdict
    verdict_payload = {
        "application_id": "APP-LIVE-RED-1087",
        "parcel_id": "P-RED-1087",
        "khasra_no": "1087/2",
        "applicant_name": "Rakesh Sahu",
        "decision": "REJECT",
        "officer_notes": "Identity mismatch and duplicate active KCC on parcel. Blocked under MISS.",
        "flags": [{"id": "FLAG-DUP-KCC", "severity": "RED"}],
    }
    res_verdict = client.post(
        "/api/v1/bank/verdict",
        json=verdict_payload,
        cookies={SESSION_COOKIE_NAME: token}
    )
    assert res_verdict.status_code == 200, res_verdict.text
    verdict_data = res_verdict.json()
    assert verdict_data["status"] == "REJECT"
    assert len(verdict_data["receipt_hash"]) == 64

    # Verify cryptographic audit chain integrity
    res_chain = client.get("/api/v1/bank/audit-log/verify")
    assert res_chain.status_code == 200
    chain_data = res_chain.json()
    assert chain_data["is_valid"] is True
    assert chain_data["total_events"] >= 4

    # Verify live SQLite KPIs
    res_kpi = client.get("/api/v1/bank/kpis")
    assert res_kpi.status_code == 200
    kpis = res_kpi.json()
    assert kpis["audit_chain_length"] >= 4
    assert kpis["blocked_count"] >= 1

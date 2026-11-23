"""
Test the live bridge between Farmer and Banker window:
1. Farmer applies for a loan (Bank Loan vs Scheme Loan)
2. Bank Officer reviews application in Workbench
3. If Bank Officer APPROVES: status updates to APPROVED in My Loans
4. If Bank Officer REJECTS: status updates to REJECTED with full rejection reason & appeal action
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.entities import Farmer, LandParcel, BankApplication, Loan, Rejection


@pytest.fixture
def client():
    return TestClient(app)


def test_farmer_banker_loan_bridge(client):
    # 1. Login as demo farmer (Ramesh Patel F-001) via Khasra
    khasra_res = client.post("/api/v1/auth/login-khasra", json={"khasra_no": "142/1"})
    assert khasra_res.status_code == 200
    farmer_data = khasra_res.json()["farmer"]
    assert "Ramesh" in farmer_data["name_en"]

    # 2. Farmer applies for a Scheme Loan (KCC)
    apply_res = client.post(
        "/api/farmer/loan-apply",
        json={
            "parcel_id": "P-101",
            "loan_category": "SCHEME_LOAN",
            "lender_name": "Chhattisgarh Rajya Gramin Bank",
            "loan_type": "KCC_CROP_LOAN",
            "requested_amount_rupees": 150000,
        }
    )
    assert apply_res.status_code == 200
    app_data = apply_res.json()
    assert app_data["status"] == "SUBMITTED"
    app_id = app_data["application_id"]

    # 3. Farmer checks My Loans - should see UNDER_REVIEW
    loans_res = client.get("/api/farmer/loans")
    assert loans_res.status_code == 200
    apps = loans_res.json()["applications"]
    target_app = next((a for a in apps if a["application_id"] == app_id), None)
    assert target_app is not None
    assert target_app["status"] == "UNDER_REVIEW"

    # 4. Bank Officer logs in
    officer_res = client.post(
        "/api/v1/auth/bank/login",
        json={"identifier": "EMP-2041", "password": "Password@123"}
    )
    assert officer_res.status_code == 200

    # 5. Bank Officer REJECTS with specific statutory reason
    verdict_res = client.post(
        "/api/v1/bank/verdict",
        json={
            "application_id": app_id,
            "khasra_no": "142/1",
            "applicant_name": farmer_data["name_en"],
            "decision": "REJECT",
            "officer_notes": "Duplicate active KCC found under MISS scheme rules. Must clear first.",
            "flags": [
                {
                    "id": "FLAG-KCC-DUPLICATE",
                    "title_en": "Duplicate Active KCC Detected",
                    "title_hi": "सक्रिय दोहरा केसीसी ऋण पाया गया",
                    "severity": "RED",
                    "rule_id": "RULE_MISS_DUPLICATE_FINANCING",
                }
            ],
        }
    )
    assert verdict_res.status_code == 200
    assert verdict_res.json()["status"] == "REJECT"

    # 6. Farmer re-checks My Loans - should see REJECT with the exact reason!
    # Re-login or use farmer session
    client.post("/api/v1/auth/login-khasra", json={"khasra_no": "142/1"})
    loans_res2 = client.get("/api/farmer/loans")
    assert loans_res2.status_code == 200
    apps2 = loans_res2.json()["applications"]
    target_app2 = next((a for a in apps2 if a["application_id"] == app_id), None)
    assert target_app2 is not None
    assert target_app2["status"] == "REJECT"
    assert target_app2["rejection"] is not None
    assert "Duplicate active KCC" in (target_app2["rejection"]["officer_notes"] or "")

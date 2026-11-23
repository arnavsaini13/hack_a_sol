import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth import SESSION_COOKIE_NAME


@pytest.fixture
def client():
    return TestClient(app)


# 1. Root & Trust Bar Check
def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OPERATIONAL"
    assert data["trust_bar"]["zero_ai_math"] is True
    assert data["trust_bar"]["mode"] == "Synthetic Demo Data"


# 2. Authentication Flow: Send OTP & Verify OTP
def test_auth_send_and_verify_otp(client):
    # Send OTP
    send_res = client.post("/api/auth/send-otp", json={"mobile": "9876543210"})
    assert send_res.status_code == 200
    assert send_res.json()["status"] == "OTP_SENT"
    assert "123456" in send_res.json()["demo_otp_hint"]

    # Verify OTP
    verify_res = client.post(
        "/api/auth/verify-otp",
        json={"mobile": "9876543210", "otp": "123456"}
    )
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert data["farmer"]["name_hi"] == "रामेश्वर पटेल"
    assert "session_token" in data
    # Verify HTTP-only cookie set
    assert SESSION_COOKIE_NAME in verify_res.cookies


# 3. Hard Rule 7: Strict Session Isolation
def test_farmer_api_session_isolation(client):
    # Attempt without session -> 401
    unauth_res = client.get("/api/farmer/snapshot")
    assert unauth_res.status_code == 401

    # Login as Farmer F-001 (Ramesh Patel)
    login_f1 = client.post(
        "/api/auth/verify-otp",
        json={"mobile": "9876543210", "otp": "123456"}
    )
    token_f1 = login_f1.json()["session_token"]

    # F-001 retrieves their snapshot
    snap_res = client.get(
        "/api/farmer/snapshot",
        cookies={SESSION_COOKIE_NAME: token_f1}
    )
    assert snap_res.status_code == 200
    assert snap_res.json()["farmer"]["id"] == "F-001"
    assert snap_res.json()["farmer"]["name_hi"] == "रामेश्वर पटेल"

    # Adversary tries to inject ?farmer_id=F-002
    spoof_res = client.get(
        "/api/farmer/snapshot?farmer_id=F-002",
        cookies={SESSION_COOKIE_NAME: token_f1}
    )
    assert spoof_res.status_code == 200
    # Must STILL return F-001, completely ignoring query param
    assert spoof_res.json()["farmer"]["id"] == "F-001"
    assert spoof_res.json()["farmer"]["id"] != "F-002"


# 4. Discrepancy Detector: KUY 18 Days Overdue
def test_discrepancy_detector_kuy_overdue(client):
    login = client.post(
        "/api/auth/verify-otp",
        json={"mobile": "9876543210", "otp": "123456"}
    )
    token = login.json()["session_token"]

    disc_res = client.get(
        "/api/farmer/discrepancies",
        cookies={SESSION_COOKIE_NAME: token}
    )
    assert disc_res.status_code == 200
    data = disc_res.json()
    assert data["total_gap_paise"] == 4151700  # ₹41,517 gap
    assert data["total_gap_display"] == "₹41,517"

    kuy_item = next((item for item in data["discrepancies"] if item["scheme_id"] == "KUY_2026"), None)
    assert kuy_item is not None
    assert kuy_item["status"] == "OVERDUE"
    assert kuy_item["days_overdue"] == 18
    assert kuy_item["gap_display"] == "₹41,517"
    assert "इकतालीस हज़ार" in kuy_item["speech_text_hi"]
    assert kuy_item["next_action"] == "GENERATE_GRIEVANCE"


# 5. Grievance Case Creation & Letter Generation
def test_case_creation_and_letter_download(client):
    login = client.post(
        "/api/auth/verify-otp",
        json={"mobile": "9876543210", "otp": "123456"}
    )
    token = login.json()["session_token"]

    case_res = client.post(
        "/api/farmer/cases",
        json={
            "parcel_id": "P-101",
            "authority_name": "जिला विपणन अधिकारी",
            "authority_designation": "खाद्य एवं नागरिक आपूर्ति विभाग",
            "scheme_id": "KUY_2026",
            "entitled_paise": 4151700,
            "actual_paise": 0,
            "gap_paise": 4151700,
            "details": "कृषक उन्नति योजना 18 दिनों से लंबित है।",
        },
        cookies={SESSION_COOKIE_NAME: token}
    )
    assert case_res.status_code == 200
    case_data = case_res.json()
    case_id = case_data["id"]
    assert len(case_data["verification_hash"]) == 64

    # Download Letter HTML
    letter_res = client.get(
        f"/api/farmer/cases/{case_id}/letter?language=hi",
        cookies={SESSION_COOKIE_NAME: token}
    )
    assert letter_res.status_code == 200
    html = letter_res.text
    assert "कृषक उन्नति योजना" in html
    assert "रामेश्वर पटेल" in html
    assert "₹41,517" in html


# 6. Bank Officer Queue & Verification
def test_bank_officer_queue_and_verify(client):
    queue_res = client.get("/api/bank/queue")
    assert queue_res.status_code == 200
    queue = queue_res.json()
    assert len(queue) >= 3

    # Check color bands
    bands = {q["match_band"] for q in queue}
    assert "GREEN" in bands
    assert "AMBER" in bands
    assert "RED" in bands

    # Verify decision approval
    app_id = queue[0]["id"]
    verify_res = client.post(
        "/api/bank/verify",
        json={"application_id": app_id, "decision": "APPROVE", "officer_notes": "All checks passed."}
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["status"] == "APPROVED"
    assert len(verify_res.json()["receipt_hash"]) == 64


# 7. Policy Bottlenecks & Small-Cell Suppression
def test_policy_bottlenecks_suppression(client):
    policy_res = client.get("/api/policy/bottlenecks")
    assert policy_res.status_code == 200
    data = policy_res.json()

    # Verify small cells (< 5) are suppressed
    suppressed_items = [b for b in data["bottlenecks"] if b["is_suppressed"]]
    assert len(suppressed_items) >= 2
    for s in suppressed_items:
        assert s["affected_count_display"] == "Under 5 (Suppressed for Privacy)"

    unsuppressed = [b for b in data["bottlenecks"] if not b["is_suppressed"]]
    for u in unsuppressed:
        assert u["affected_count_display"].isdigit()


# 8. Immutable Audit Log Integrity
def test_policy_audit_log_chain(client):
    audit_res = client.get("/api/policy/audit-log")
    assert audit_res.status_code == 200
    data = audit_res.json()
    assert data["chain_valid"] is True
    assert data["tamper_detected"] is False
    assert data["integrity_status"] == "VERIFIED_UNBROKEN"
    assert data["total_events"] >= 5


# 9. Rules API & Provenance Badges
def test_rules_api_provenance(client):
    rules_res = client.get("/api/rules")
    assert rules_res.status_code == 200
    data = rules_res.json()
    assert len(data["rules"]) >= 15
    # Enforce Hard Rule 6: Statutory policy rules start verified=false and render as "Pending verification"
    policy_rule_ids = {
        "MSP_PADDY_COMMON",
        "KUY_BONUS",
        "RRB_BASE_RATE",
        "RRB_SUBVENTION",
        "OPERATIONAL_LOAN_CAP",
        "PMFBY_PREMIUM_KHARIF",
    }
    for r in data["rules"]:
        if r["rule_id"] in policy_rule_ids:
            assert r["provenance_badge"] == "Pending verification"
            assert r["verified"] is False
    assert data["trust_bar"]["data_mode"] == "Synthetic Demo Data"

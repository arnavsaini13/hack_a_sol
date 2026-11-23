import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_khasra_login():
    # Login with Khasra 142/1 (Ramesh Patel)
    res = client.post("/api/auth/login-khasra", json={"khasra_no": "142/1", "registry_no": "F-001"})
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["farmer"]["id"] == "F-001"
    assert data["farmer"]["name_hi"] == "रामेश्वर पटेल"
    assert "session_token" in data

def test_signup_otp_and_verify():
    # Step 1: Send OTP to new mobile
    test_mobile = "9823456789"
    res1 = client.post("/api/auth/signup-send-otp", json={"mobile": test_mobile})
    assert res1.status_code == 200, res1.text
    otp_data = res1.json()
    assert otp_data["status"] == "OTP_SENT"
    otp = otp_data["otp"]
    assert len(otp) == 6
    assert otp.isdigit()

    # Step 2: Verify OTP and create farmer
    res2 = client.post(
        "/api/auth/signup-verify",
        json={"mobile": test_mobile, "otp": otp, "khasra_no": "999/1", "name": "राजेश कुमार"}
    )
    assert res2.status_code == 200, res2.text
    verify_data = res2.json()
    assert verify_data["farmer"]["mobile"] == test_mobile
    assert "F-" in verify_data["farmer"]["id"]
    assert "session_token" in verify_data

def test_explain_rejection_all_crops_and_custom_other():
    # 1. Test Wheat with excessive moisture (16% > 14% threshold)
    res_wheat = client.post(
        "/api/farmer/explain-rejection",
        json={
            "crop_name": "Wheat (गेहूं)",
            "reason_chip": "REJ-MOISTURE",
            "moisture_pct": "16.0"
        }
    )
    assert res_wheat.status_code == 200, res_wheat.text
    w_data = res_wheat.json()
    assert w_data["verdict"] == "CANNOT_VERIFY"
    assert "Wheat" in w_data["explanation_en"]
    assert "16" in w_data["explanation_hi"]

    # 2. Test "Other" with custom text reason
    custom_text = "बारदाने की अनुपलब्धता के कारण मंडी टोकन निरस्त किया गया"
    res_custom = client.post(
        "/api/farmer/explain-rejection",
        json={
            "crop_name": "Soybean (सोयाबीन)",
            "reason_chip": "REJ-OTHER",
            "custom_reason": custom_text
        }
    )
    assert res_custom.status_code == 200, res_custom.text
    c_data = res_custom.json()
    assert c_data["verdict"] == "WRONGFUL"
    assert custom_text in c_data["explanation_hi"]
    assert "Soybean" in c_data["explanation_en"]


def test_scheme_evaluation_v1_and_interactive_qa():
    # Login as Ramesh Patel
    login_res = client.post("/api/auth/login-khasra", json={"khasra_no": "142/1", "registry_no": "F-001"})
    assert login_res.status_code == 200
    token = login_res.json()["session_token"]

    # 1. Evaluate schemes without extra answers -> All 5 schemes evaluated
    eval_res1 = client.post("/api/v1/farmer/schemes/evaluate", json={"answers": {}}, cookies={"agri_session": token})
    assert eval_res1.status_code == 200, eval_res1.text
    data1 = eval_res1.json()
    assert data1["total_evaluated"] == 5
    assert len(data1["eligible_schemes"]) >= 4

    # 2. Interactive Q&A: User answers they did NOT repay loan within 12m
    eval_res2 = client.post(
        "/api/v1/farmer/schemes/evaluate",
        json={"answers": {"kcc_repaid_within_12m": False}},
        cookies={"agri_session": token}
    )
    assert eval_res2.status_code == 200
    data2 = eval_res2.json()
    not_eligible_ids = [s["scheme_id"] for s in data2["not_eligible_schemes"]]
    assert "RULE_KCC_SUBVENTION" in not_eligible_ids


def test_interactive_calculators_pure_python():
    # Test KCC interactive calculation
    kcc_res = client.post(
        "/api/farmer/calculate-kcc",
        json={
            "principal_paise": 20000000,
            "lender_type": "COMMERCIAL",
            "is_repaid_timely": True,
            "duration_months": 12,
            "actual_interest_charged_paise": 1400000  # Charged 7% instead of 4%
        }
    )
    assert kcc_res.status_code == 200
    kcc_data = kcc_res.json()
    assert kcc_data["effective_rate_pct"] == 4.0
    assert kcc_data["entitled_interest_paise"] == 800000  # ₹8,000
    assert kcc_data["gap_paise"] == 600000  # ₹6,000 overcharge
    assert kcc_data["is_overcharged"] is True
    assert len(kcc_data["rule_steps"]) == 4

    # Test Paddy interactive calculation
    paddy_res = client.post(
        "/api/farmer/calculate-paddy",
        json={
            "acres": 4.0,
            "grade": "COMMON",
            "moisture_pct": 18.0,
            "quantity_offered_quintals": 84.0,
            "actual_received_paise": 0
        }
    )
    assert paddy_res.status_code == 200
    paddy_data = paddy_res.json()
    assert paddy_data["cap_quintals"] == 84.0
    assert paddy_data["composite_rate_paise"] == 310000  # ₹3,100/qtl
    assert paddy_data["moisture_status"] == "ALERT"
    assert paddy_data["moisture_deduction_paise"] > 0


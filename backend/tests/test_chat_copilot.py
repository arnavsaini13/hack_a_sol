"""
Unit & Integration Tests for Gemini Co-Pilot, Tools & Guardrails.
Verifies:
1. Deterministic placeholder substitution (zero {{...}} tokens remaining).
2. Number-to-words for English and Hindi (including INR currency and percentages).
3. Chat tools execution across real DB farmer records with pure-Python rules.
4. GET /api/chat/profiles returning non-PII safe fields only.
5. POST /api/chat and POST /api/chat/scan endpoints.
"""
import io
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.entities import Farmer
from app.services.chat_guardrails import (
    substitute_placeholders,
    currency_to_words,
    percentage_to_words,
    number_to_spoken_words,
    convert_text_to_tts,
    process_chat_response,
)
from app.services.chat_tools import make_user_tools


@pytest.fixture
def client():
    return TestClient(app)


# ── 1. Guardrails Tests ──────────────────────────────────────────────

def test_placeholder_substitution():
    sink = {
        "kcc_limit": "₹1,80,000",
        "interest_rate": "4%",
        "crop": "Paddy",
    }
    raw = "Your eligible limit is {{kcc_limit}} at {{interest_rate}} for {{crop}}."
    result = substitute_placeholders(raw, sink)
    assert result == "Your eligible limit is ₹1,80,000 at 4% for Paddy."
    assert "{{" not in result and "}}" not in result


def test_dangling_placeholder_cleanup():
    sink = {"kcc_limit": "₹1,80,000"}
    raw = "Amount: {{kcc_limit}}, Bonus: {{unknown_token}}"
    result = substitute_placeholders(raw, sink)
    assert "Amount: ₹1,80,000, Bonus:" in result
    assert "{{" not in result and "}}" not in result


def test_currency_to_words():
    # English
    en_words = currency_to_words("2,00,000", "en")
    assert "Two Lakh" in en_words
    assert "Rupees" in en_words

    # Hindi
    hi_words = currency_to_words("2,00,000", "hi")
    assert "दो लाख" in hi_words
    assert "रुपये" in hi_words

    # Chhattisgarhi (uses Hindi phonetics)
    chh_words = currency_to_words("15,000", "chh")
    assert "पंद्रह हज़ार" in chh_words


def test_percentage_to_words():
    assert "Four percent" in percentage_to_words("4", "en")
    assert "चार प्रतिशत" in percentage_to_words("4", "hi")
    assert "सात प्रतिशत" in percentage_to_words("7", "chh")


def test_dual_response_pipeline():
    sink = {"kcc_limit": "₹2,00,000", "rate": "4%"}
    raw = "आपकी सीमा {{kcc_limit}} है, ब्याज दर {{rate}} होगी।"
    processed = process_chat_response(raw, sink, language="hi")

    # Display text retains standard digits
    assert "₹2,00,000" in processed["display_text"]
    assert "4%" in processed["display_text"]

    # TTS text converts to spoken Hindi words
    assert "दो लाख रुपये" in processed["tts_text"]
    assert "चार प्रतिशत" in processed["tts_text"]


# ── 2. Chat Tools Tests ──────────────────────────────────────────────

def test_make_user_tools_bound():
    db = SessionLocal()
    try:
        farmer = db.query(Farmer).first()
        assert farmer is not None, "At least one farmer should be seeded"

        tool_data_sink = {}
        ui_action_sink = []

        tools = make_user_tools(farmer.id, db, tool_data_sink, ui_action_sink)
        assert len(tools) == 4

        get_eligible_policies, check_payment_status, calculate_kcc_limit, control_ui = tools

        # Test policy tool
        policy_res = get_eligible_policies()
        assert "schemes_evaluated" in policy_res
        assert len(policy_res["schemes_evaluated"]) > 0

        # Test payment status tool
        status_res = check_payment_status()
        assert "farmer_name" in status_res
        assert "bottlenecks" in status_res

        # Test KCC calculator tool
        kcc_res = calculate_kcc_limit(requested_amount=100000, tenure_months=12)
        assert "evaluated_principal" in kcc_res
        assert "kcc_limit" in tool_data_sink
        assert "kcc_prompt_interest" in tool_data_sink

        # Test control UI tool
        ui_res = control_ui(route="/farmer", amount=150000, scheme_filter="kcc")
        assert ui_res["status"] == "QUEUED"
        assert len(ui_action_sink) == 1
        assert ui_action_sink[0]["type"] == "NAVIGATE_AND_FILL"
        assert ui_action_sink[0]["fields"]["amount"] == 150000
    finally:
        db.close()


# ── 3. API Router Integration Tests ──────────────────────────────────

def test_api_chat_profiles(client):
    res = client.get("/api/chat/profiles")
    assert res.status_code == 200
    data = res.json()
    assert "profiles" in data
    assert len(data["profiles"]) > 0

    profile = data["profiles"][0]
    # Verify NON-PII guarantees
    assert "id" in profile
    assert "name" in profile
    assert "district" in profile
    assert "land_acres" in profile
    assert "crop" in profile
    assert "ekyc_pending" in profile
    # Ensure sensitive PII is absent
    assert "aadhaar" not in profile
    assert "bank_account" not in profile
    assert "pan" not in profile


def test_api_chat_endpoint(client):
    res = client.post(
        "/api/chat",
        json={
            "message": "What is my eligible KCC loan limit and interest rate?",
            "language": "en",
            "page_context": {
                "page": "Entitlement Calculator",
                "route": "/farmer",
                "summary": "KCC Loan Entitlements",
            },
            "history": [],
        },
        headers={"X-Farmer-Id": "F-001"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "display_text" in data
    assert "tts_text" in data
    assert "language" in data
    assert len(data["display_text"]) > 0
    assert len(data["tts_text"]) > 0


def test_api_chat_scan_endpoint(client):
    # Simulated 1x1 GIF byte payload
    fake_image = io.BytesIO(b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;")
    res = client.post(
        "/api/chat/scan",
        files={"file": ("rejection_slip.gif", fake_image, "image/gif")},
        data={"prompt": "Explain why my loan was rejected", "language": "hi"},
        headers={"X-Farmer-Id": "F-001"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "display_text" in data
    assert "tts_text" in data
    assert data["language"] == "hi"

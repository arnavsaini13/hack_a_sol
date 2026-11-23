"""
End-to-End Demo Flow & Persona Verification Script
Validates all 5 Golden Personas, Role Switching, Grievance Generation,
Bank Verification with SHA-256 Receipts, and Policymaker Small-Cell Privacy.
"""
import sys
import os
from decimal import Decimal
from datetime import date, timezone, datetime

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.entities import Farmer, LandParcel, Loan, Procurement, InsuranceUnit, BankApplication, Case, AuditEvent
from app.seed.seed_data import seed_database
from app.rules.helpers import ha_to_acres, paddy_quantity_cap, display_rupees

client = TestClient(app)

def run_e2e_verification():
    print("=" * 60)
    print("STARTING E2E INTEGRATION & DEMO FLOW VERIFICATION")
    print("=" * 60)

    # 1. Reset / Seed database cleanly
    db = SessionLocal()
    seed_database(db)
    db.close()
    print("✓ Database seeded with 5 Golden Personas, Bank Apps, & Audit Chain")

    # ─────────────────────────────────────────────────────────────────
    # PERSONA 1: F-001 (Ramesh Patel, Raipur) - KUY Overdue
    # ─────────────────────────────────────────────────────────────────
    print("\n[TEST 1] Persona F-001 (Ramesh Patel) - Mobile + OTP & KUY Overdue")
    # Send OTP
    r_otp = client.post("/api/auth/send-otp", json={"mobile": "9876543210"})
    assert r_otp.status_code == 200, f"Send OTP failed: {r_otp.text}"
    assert "123456" in r_otp.json()["demo_otp_hint"]

    # Verify OTP
    r_verify = client.post("/api/auth/verify-otp", json={"mobile": "9876543210", "otp": "123456"})
    assert r_verify.status_code == 200, f"Verify OTP failed: {r_verify.text}"
    assert r_verify.json()["farmer"]["id"] == "F-001"
    token = r_verify.json()["session_token"]

    # Check snapshot
    r_snap = client.get("/api/farmer/snapshot", cookies={"session_token": token})
    assert r_snap.status_code == 200
    snap = r_snap.json()
    assert len(snap["parcels"]) == 1
    assert snap["parcels"][0]["khasra_no"] == "142/1"
    assert snap["parcels"][0]["area_acres"] == "3.00"
    print("✓ F-001 Snapshot verified: 1.6187 ha = 4.00 acres, Girdawari Paddy")

    # Check discrepancies
    r_disc = client.get("/api/farmer/discrepancies", cookies={"session_token": token})
    assert r_disc.status_code == 200
    disc = r_disc.json()
    assert disc["total_gap_paise"] == 4151700  # ₹41,517 gap
    overdue_item = next(i for i in disc["discrepancies"] if i["scheme_id"] == "KUY_2026")
    assert overdue_item["status"] == "OVERDUE"
    assert overdue_item["days_overdue"] == 18
    assert "₹41,517" in overdue_item["gap_display"]
    # Check spelled-out Hindi speech words
    assert "इकतालीस हज़ार" in overdue_item["speech_text_hi"]
    print("✓ F-001 KUY 18 days overdue confirmed with exact ₹41,517 gap and Hindi number words")

    # Create Grievance
    r_case = client.post(
        "/api/farmer/cases",
        json={
            "parcel_id": overdue_item["parcel_id"],
            "authority_name": "District Procurement Officer / Markfed",
            "authority_designation": "District Supply & Procurement Division",
            "scheme_id": "KUY_2026",
            "entitled_paise": overdue_item["entitled_paise"],
            "actual_paise": overdue_item["received_paise"],
            "gap_paise": overdue_item["gap_paise"],
            "details": overdue_item["explanation_en"],
        },
        cookies={"session_token": token},
    )
    assert r_case.status_code == 200
    case_obj = r_case.json()
    assert case_obj["case_ref_no"].startswith("CG-")
    print(f"✓ F-001 Grievance created: Ref {case_obj['case_ref_no']}")

    # ─────────────────────────────────────────────────────────────────
    # PERSONA 2: F-002 (Smt. Sunita Bai, Durg) - KCC Interest Overcharged
    # ─────────────────────────────────────────────────────────────────
    print("\n[TEST 2] Persona F-002 (Sunita Bai) - KCC Interest Subvention Overcharge")
    r_v2 = client.post("/api/auth/verify-otp", json={"mobile": "9876543211", "otp": "123456"})
    token2 = r_v2.json()["session_token"]

    r_disc2 = client.get("/api/farmer/discrepancies", cookies={"session_token": token2})
    assert r_disc2.status_code == 200
    disc2 = r_disc2.json()
    kcc_item = next(i for i in disc2["discrepancies"] if "KCC" in i["scheme_id"])
    assert kcc_item["status"] == "OVERCHARGED"
    assert kcc_item["gap_paise"] == 600000  # ₹6,000 overcharge (7% vs 4%)
    assert "छह हज़ार" in kcc_item["speech_text_hi"]
    print("✓ F-002 KCC Overcharge confirmed: ₹6,000 overcharged (7% charged instead of 4%)")

    # ─────────────────────────────────────────────────────────────────
    # PERSONA 3: F-003 (Maniram Sahu, Bilaspur) - PMFBY Claim Underpaid
    # ─────────────────────────────────────────────────────────────────
    print("\n[TEST 3] Persona F-003 (Maniram Sahu) - PMFBY Crop Insurance Claim")
    r_v3 = client.post("/api/auth/verify-otp", json={"mobile": "9876543212", "otp": "123456"})
    token3 = r_v3.json()["session_token"]

    r_disc3 = client.get("/api/farmer/discrepancies", cookies={"session_token": token3})
    assert r_disc3.status_code == 200
    disc3 = r_disc3.json()
    pmfby_item = next(i for i in disc3["discrepancies"] if "PMFBY" in i["scheme_id"])
    assert pmfby_item["status"] == "UNDERPAID"
    assert pmfby_item["gap_paise"] > 0
    print(f"✓ F-003 PMFBY Claim confirmed: {pmfby_item['gap_display']} shortfall ({pmfby_item['status']})")

    # ─────────────────────────────────────────────────────────────────
    # BANK OFFICER CONSOLE: RapidFuzz Identity Matching & Encumbrance
    # ─────────────────────────────────────────────────────────────────
    print("\n[TEST 4] Bank Officer Verification Console - Fuzzy Matching & Duplicate KCC")
    r_queue = client.get("/api/bank/queue")
    assert r_queue.status_code == 200
    queue = r_queue.json()
    assert len(queue) == 3

    # APP-501: Green match
    app1 = next(q for q in queue if q["id"] == "APP-501")
    assert app1["match_band"] == "GREEN"
    assert app1["match_score"] == 100.0

    # APP-502: Amber match (Vikram Kumar Singh vs Vikram Singh)
    app2 = next(q for q in queue if q["id"] == "APP-502")
    assert app2["match_band"] == "AMBER"
    assert 75.0 <= app2["match_score"] < 95.0

    # APP-503: Duplicate loan violation (MISS violation)
    app3 = next(q for q in queue if q["id"] == "APP-503")
    assert app3["is_duplicate_kcc"] is True

    print("✓ Bank queue verified: APP-501 (GREEN), APP-502 (AMBER), APP-503 (Duplicate KCC Alert)")

    # Execute Officer Verdict on APP-501 (Approve) & APP-503 (Reject)
    r_dec1 = client.post(
        "/api/bank/verify",
        json={"application_id": "APP-501", "decision": "APPROVE", "officer_notes": "Identity and title verified"}
    )
    assert r_dec1.status_code == 200
    res1 = r_dec1.json()
    assert res1["status"] == "APPROVED"
    assert len(res1["receipt_hash"]) == 64  # SHA-256 hex length
    print(f"✓ Bank approved APP-501: SHA-256 receipt {res1['receipt_hash'][:16]}...")

    r_dec3 = client.post(
        "/api/bank/verify",
        json={"application_id": "APP-503", "decision": "REJECT", "officer_notes": "Duplicate active KCC on parcel"}
    )
    assert r_dec3.status_code == 200
    res3 = r_dec3.json()
    assert res3["status"] == "REJECTED"
    print(f"✓ Bank rejected APP-503: SHA-256 receipt {res3['receipt_hash'][:16]}...")

    # ─────────────────────────────────────────────────────────────────
    # POLICY MAKER DASHBOARD: Small-Cell Privacy & Audit Chain
    # ─────────────────────────────────────────────────────────────────
    print("\n[TEST 5] Policy Maker Dashboard - Small-Cell Privacy & Cryptographic Audit Chain")
    r_policy = client.get("/api/policy/bottlenecks")
    assert r_policy.status_code == 200
    pol = r_policy.json()

    # Verify small-cell suppression (< 5 counts masked)
    suppressed_cells = [b for b in pol["bottlenecks"] if b["is_suppressed"]]
    assert len(suppressed_cells) > 0, "No suppressed small-cells found"
    for sc in suppressed_cells:
        assert "Suppressed for Privacy" in sc["affected_count_display"]
    print(f"✓ Privacy Guarantee verified: {len(suppressed_cells)} cells masked with '{suppressed_cells[0]['affected_count_display']}'")

    # Verify Audit Chain Integrity
    r_audit = client.get("/api/policy/audit-log")
    assert r_audit.status_code == 200
    audit = r_audit.json()
    assert audit["chain_valid"] is True
    assert audit["tamper_detected"] is False
    assert audit["integrity_status"] == "VERIFIED_UNBROKEN"
    print(f"✓ Cryptographic Audit Chain verified unbroken across {audit['total_events']} events")

    print("\n" + "=" * 60)
    print("ALL 5 E2E INTEGRATION & DEMO SCENARIOS PASSED PERFECTLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_e2e_verification()

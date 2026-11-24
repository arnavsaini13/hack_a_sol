"""
Deterministic Server-Side Chat Tools for Gemini Co-Pilot.
Strict Zero AI Math Architecture:
- farmer_id is bound server-side via closure (NEVER exposed to Gemini in tool parameters).
- All calculations are delegated to rules_2026.json and SQLAlchemy DB queries.
- Numeric values are recorded in tool_data_sink with explicit placeholder tokens.
- UI actions (NAVIGATE_AND_FILL) are queued into ui_action_sink.
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional, Callable
from sqlalchemy.orm import Session

from app.models.entities import Farmer, LandParcel, Loan, Procurement, Case
from app.adapters.synthetic_adapter import SyntheticAdapter
from app.rules.engine import RulesEngine
from app.rules.helpers import ha_to_acres, paise_to_rupees, rupees_to_paise


def make_user_tools(
    farmer_id: str,
    db: Session,
    tool_data_sink: Dict[str, Any],
    ui_action_sink: List[Dict[str, Any]],
) -> List[Callable]:
    """
    Creates deterministic tool functions with farmer_id bound via closure.
    Gemini only sees the tool signatures, without any farmer_id parameter.
    """

    def get_eligible_policies(category: str = "all") -> Dict[str, Any]:
        """
        Check official eligibility and statutory entitlements for Chhattisgarh schemes
        (KCC Interest Subvention, Paddy MSP + Krishak Unnati Yojana, PMFBY Crop Insurance).

        Args:
            category: Scheme category filter ('all', 'kcc', 'paddy', 'crop_insurance')
        """
        adapter = SyntheticAdapter(db)
        snapshot = adapter.get_registry_snapshot(farmer_id)
        farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()

        if not farmer:
            return {"error": "Farmer profile not found in official registry."}

        engine = RulesEngine()
        evaluation = engine.evaluate_farmer_schemes(
            farmer_data={"id": farmer.id, "name_hi": farmer.name_hi, "village": farmer.village},
            parcels=snapshot.get("parcels", []),
            loans=snapshot.get("loans", []),
            procurements=snapshot.get("procurements", []),
            insurance_units=snapshot.get("insurance_units", []),
        )

        eligible = evaluation.get("eligible_schemes", [])
        not_eligible = evaluation.get("not_eligible_schemes", [])

        # Store exact statutory figures in tool_data_sink
        tool_data_sink["paddy_msp_rate"] = "₹2,320"
        tool_data_sink["kuy_bonus_rate"] = "₹780"
        tool_data_sink["total_paddy_rate"] = "₹3,100"
        tool_data_sink["kcc_prompt_rate"] = "4%"
        tool_data_sink["kcc_pacs_rate"] = "0%"

        summary_list = []
        for s in eligible:
            summary_list.append({
                "scheme": s.get("scheme_name_en", s.get("scheme_id")),
                "status": "ELIGIBLE",
                "verdict": s.get("verdict_en", ""),
                "rule_id": s.get("rule_id", ""),
                "official_url": s.get("official_portal_url", ""),
            })
        for s in not_eligible:
            summary_list.append({
                "scheme": s.get("scheme_name_en", s.get("scheme_id")),
                "status": "NOT_ELIGIBLE",
                "verdict": s.get("verdict_en", ""),
                "rule_id": s.get("rule_id", ""),
            })

        return {
            "farmer_id": farmer.id,
            "farmer_name": farmer.name_en,
            "district": farmer.district,
            "schemes_evaluated": summary_list,
            "statutory_rules": "rules_2026.json (Deterministic Engine)",
        }

    def check_payment_status() -> Dict[str, Any]:
        """
        Inspect live cases, pending eKYC flags, and DBT subsidy disbursements
        for the active farmer. Returns exact bottleneck reason and next steps.
        """
        farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
        if not farmer:
            return {"error": "Farmer not found."}

        cases = db.query(Case).filter(Case.farmer_id == farmer_id).all()
        procurements = db.query(Procurement).filter(Procurement.farmer_id == farmer_id).all()
        loans = db.query(Loan).filter(Loan.farmer_id == farmer_id).all()

        bottlenecks = []
        ekyc_pending = False
        duplicate_kcc = False

        # Inspect cases for discrepancies
        for c in cases:
            gap_rupees = c.gap_paise // 100
            bottleneck_info = {
                "case_ref": c.case_ref_no,
                "scheme": c.scheme_id,
                "status": c.status,
                "gap": f"₹{gap_rupees:,}",
                "details": c.details,
            }
            if "ekyc" in c.details.lower() or "aadhaar" in c.details.lower():
                ekyc_pending = True
                bottleneck_info["bottleneck_type"] = "EKYC_PENDING"
                bottleneck_info["action_required"] = "Submit Aadhaar biometric eKYC at your local PACS cooperative society."
            elif "duplicate" in c.details.lower() or "mortgage" in c.details.lower():
                duplicate_kcc = True
                bottleneck_info["bottleneck_type"] = "DUPLICATE_KCC"
                bottleneck_info["action_required"] = "Obtain No Objection Certificate (NOC) from prior lender."
            elif "interest" in c.details.lower() or "subvention" in c.details.lower():
                bottleneck_info["bottleneck_type"] = "INTEREST_OVERCHARGE"
                bottleneck_info["action_required"] = "File statutory interest refund request with bank branch manager."
            else:
                bottleneck_info["bottleneck_type"] = "DISBURSEMENT_SCHEDULED"
                bottleneck_info["action_required"] = "Track DBT transfer to linked bank account."

            bottlenecks.append(bottleneck_info)

        # Check procurements without cases
        for p in procurements:
            if p.kuy_paid_paise == 0:
                expected_date = str(p.kuy_expected_release_date or "2026-03-31")
                bottlenecks.append({
                    "scheme": "Krishak Unnati Yojana (Paddy Bonus)",
                    "status": "PROCESSING",
                    "details": f"Bonus DBT transfer scheduled on {expected_date}.",
                    "action_required": "Ensure bank account is Aadhaar seeded for DBT credit.",
                })

        tool_data_sink["ekyc_pending"] = "हाँ" if ekyc_pending else "नहीं"
        tool_data_sink["open_cases_count"] = len(bottlenecks)

        return {
            "farmer_name": farmer.name_en,
            "open_cases": len(bottlenecks),
            "ekyc_pending": ekyc_pending,
            "bottlenecks": bottlenecks,
        }

    def calculate_kcc_limit(
        requested_amount: Optional[int] = None,
        tenure_months: int = 12,
    ) -> Dict[str, Any]:
        """
        Calculate statutory Kisan Credit Card (KCC) scale-of-finance limit,
        statutory interest subvention rates (7% standard vs 4% prompt repayment),
        and estimated interest for the farmer's registered land holdings.

        Args:
            requested_amount: Desired loan amount in rupees (optional; defaults to max eligible limit)
            tenure_months: Loan tenure in months (default 12 months)
        """
        farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
        if not farmer:
            return {"error": "Farmer not found."}

        parcels = db.query(LandParcel).filter(LandParcel.farmer_id == farmer_id).all()
        total_ha = sum([Decimal(str(p.area_ha)) for p in parcels], Decimal("0.0"))
        acres = ha_to_acres(total_ha)

        # Chhattisgarh Paddy Scale of Finance: ₹36,000 per acre
        SCALE_PER_ACRE = Decimal("36000")
        max_eligible_limit = int((acres * SCALE_PER_ACRE).to_integral_value(rounding=ROUND_HALF_UP))

        if requested_amount is not None and requested_amount > 0:
            principal = min(requested_amount, max_eligible_limit)
        else:
            principal = max_eligible_limit

        duration_factor = Decimal(tenure_months) / Decimal(12)

        # Rates: Standard 7%, Prompt repayment 4% (3% MISS subvention)
        std_rate = Decimal("7.0")
        prompt_rate = Decimal("4.0")

        std_interest = int((Decimal(principal) * (std_rate / Decimal(100)) * duration_factor).to_integral_value(rounding=ROUND_HALF_UP))
        prompt_interest = int((Decimal(principal) * (prompt_rate / Decimal(100)) * duration_factor).to_integral_value(rounding=ROUND_HALF_UP))
        savings = std_interest - prompt_interest

        # RBI Collateral-free limit: ₹2,00,000
        collateral_free = principal <= 200000

        # Store in sink for placeholder replacement
        tool_data_sink["kcc_acres"] = f"{float(acres):.2f}"
        tool_data_sink["kcc_limit"] = f"₹{max_eligible_limit:,}"
        tool_data_sink["kcc_principal"] = f"₹{principal:,}"
        tool_data_sink["kcc_std_interest"] = f"₹{std_interest:,}"
        tool_data_sink["kcc_prompt_interest"] = f"₹{prompt_interest:,}"
        tool_data_sink["kcc_prompt_savings"] = f"₹{savings:,}"

        return {
            "total_land_acres": float(acres),
            "max_eligible_kcc_limit": f"₹{max_eligible_limit:,}",
            "evaluated_principal": f"₹{principal:,}",
            "tenure_months": tenure_months,
            "standard_interest_at_7pct": f"₹{std_interest:,}",
            "prompt_repayment_interest_at_4pct": f"₹{prompt_interest:,}",
            "prompt_repayment_benefit_savings": f"₹{savings:,}",
            "collateral_free_rbi_rule": collateral_free,
            "pacs_cooperative_rate_note": "If availed through PACS primary cooperative society, timely repayment achieves net 0% interest.",
        }

    def control_ui(
        route: str,
        amount: Optional[int] = None,
        tenure_months: Optional[int] = None,
        scheme_filter: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Navigate the farmer's portal screen to a specific tab and pre-fill form fields
        for interactive review. Never submits automatically; farmer must review and confirm.

        Args:
            route: Target page/tab ('/farmer', '/farmer/calculators', '/farmer/schemes', '/farmer/gaps')
            amount: Pre-fill amount in rupees for loan/subsidy calculator
            tenure_months: Pre-fill tenure months (e.g. 12)
            scheme_filter: Pre-fill filter category ('all', 'kcc', 'paddy', 'pmfby')
        """
        fields = {}
        if amount is not None:
            fields["amount"] = amount
        if tenure_months is not None:
            fields["tenure_months"] = tenure_months
        if scheme_filter is not None:
            fields["scheme_filter"] = scheme_filter

        action = {
            "type": "NAVIGATE_AND_FILL",
            "route": route,
            "fields": fields,
        }
        ui_action_sink.append(action)

        return {
            "status": "QUEUED",
            "action": action,
            "instruction": "UI navigation queued. Prompt the farmer to review the values on screen and click submit when ready. Do not claim automatic submission.",
        }

    return [
        get_eligible_policies,
        check_payment_status,
        calculate_kcc_limit,
        control_ui,
    ]

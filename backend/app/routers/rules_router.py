"""
Rules and Provenance router: Exposes rules_2026.json with explicit verification status.
"""
from fastapi import APIRouter
from app.rules.engine import load_rules, rules_meta
from app.schemas.schemas import RulesListResponse, RuleItemSchema

router = APIRouter(prefix="/api/rules", tags=["Rules"])


@router.get("", response_model=RulesListResponse)
def get_rules():
    """Return all statutory rules with provenance metadata and verification status."""
    rules_dict = load_rules()
    meta = rules_meta()

    items = []
    for r in rules_dict.values():
        is_verified = r.get("verified", False)
        badge = "Verified government rule" if is_verified else "Pending verification"
        items.append(
            RuleItemSchema(
                rule_id=r["rule_id"],
                description=r["description"],
                value=r["value"],
                unit=r["unit"],
                source_url=r["source_url"],
                effective_date=r["effective_date"],
                last_verified=r["last_verified"],
                verified=is_verified,
                provenance_badge=badge,
            )
        )

    return RulesListResponse(
        rules=items,
        meta=meta,
        trust_bar={
            "data_mode": "Synthetic Demo Data",
            "rules_last_verified": meta.get("rules_last_verified", "2026-03-01"),
            "verification_state": "All policy rule values pending official state gazette verification",
        },
    )


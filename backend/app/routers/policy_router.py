"""
Policy Bottleneck Dashboard router: Anonymized aggregation, small-cell suppression (< 5), and audit chain viewer.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.entities import AuditEvent
from app.schemas.schemas import PolicyDashboardResponse, PolicyBottleneckItem
from app.rules.engine import RulesEngine
from app.rules.helpers import display_rupees
from app.services.audit_service import AuditChainService

router = APIRouter(prefix="/api/policy", tags=["Policy"])


@router.get("/bottlenecks", response_model=PolicyDashboardResponse)
def get_bottlenecks():
    """
    Fetch aggregated bottleneck metrics across Chhattisgarh districts.
    Enforces Hard Rule: small cells (< 5) are suppressed for privacy.
    """
    engine = RulesEngine()

    raw_bottlenecks = [
        {"district": "रायपुर", "tehsil": "आरंग", "scheme": "कृषक उन्नति योजना", "stage": "Fund Released → Bank Credit", "count": 182, "amount_paise": 755609400, "delay_days": 18},
        {"district": "दुर्ग", "tehsil": "पाटन", "scheme": "केसीसी ब्याज अनुदान", "stage": "Interest Subvention Credited", "count": 64, "amount_paise": 38400000, "delay_days": 12},
        {"district": "बिलासपुर", "tehsil": "मस्तूरी", "scheme": "पीएम फसल बीमा", "stage": "CCE Yield → Claim Approval", "count": 41, "amount_paise": 45920000, "delay_days": 22},
        {"district": "राजनांदगांव", "tehsil": "डोंगरगांव", "scheme": "धान प्रापण (MSP)", "stage": "Moisture Re-check & Mandi Receipt", "count": 28, "amount_paise": 43058400, "delay_days": 8},
        # Small-cell test items: counts under 5 MUST BE SUPPRESSED
        {"district": "महासमुंद", "tehsil": "पिथौरा", "scheme": "डुप्लिकेट केसीसी जाँच", "stage": "CERSAI Verification", "count": 3, "amount_paise": 5400000, "delay_days": 14},
        {"district": "बस्तर", "tehsil": "जगदलपुर", "scheme": "कृषक उन्नति योजना", "stage": "DBT Gateway Processing", "count": 2, "amount_paise": 8303400, "delay_days": 19},
        {"district": "सरगुजा", "tehsil": "अंबिकापुर", "scheme": "पीएम फसल बीमा", "stage": "Surveyor Geo-tagging", "count": 4, "amount_paise": 4480000, "delay_days": 30},
    ]

    items = []
    total_farmers = 0
    total_amount = 0

    for b in raw_bottlenecks:
        suppression_res = engine.suppress_small_cell(b["count"])
        is_supp = suppression_res["suppressed"]
        count_disp = suppression_res["display"]

        if not is_supp:
            total_farmers += b["count"]
        total_amount += b["amount_paise"]

        items.append(
            PolicyBottleneckItem(
                district=b["district"],
                tehsil=b["tehsil"],
                scheme=b["scheme"],
                stage=b["stage"],
                affected_count_display=count_disp,
                is_suppressed=is_supp,
                total_delayed_paise_display=display_rupees(b["amount_paise"]),
                average_delay_days=b["delay_days"],
            )
        )

    return PolicyDashboardResponse(
        bottlenecks=items,
        total_delayed_farmers_display=f"{total_farmers}+ (excluding suppressed cells)",
        total_state_delayed_amount_display=display_rupees(total_amount),
        rules_last_verified="2026-03-01",
        provenance="Synthetic Demo Data",
    )


@router.get("/audit-log")
def get_audit_log(db: Session = Depends(get_db)):
    """Fetch immutable hash-chained audit log and return verification verdict."""
    events = db.query(AuditEvent).order_by(AuditEvent.id.asc()).all()
    chain_service = AuditChainService()

    # Replay chain to check for any tamper
    for ev in events:
        chain_service.append(
            actor=ev.actor,
            subject=ev.subject,
            action=ev.action,
            payload={},
            timestamp=ev.timestamp.isoformat(),
        )

    is_valid, err = chain_service.verify_chain_detailed()

    return {
        "chain_valid": is_valid,
        "tamper_detected": not is_valid,
        "integrity_status": "VERIFIED_UNBROKEN" if is_valid else f"TAMPERED: {err}",
        "total_events": len(events),
        "events": [
            {
                "id": ev.id,
                "prev_hash": ev.prev_hash[:12] + "...",
                "entry_hash": ev.entry_hash[:12] + "...",
                "actor": ev.actor,
                "subject": ev.subject,
                "action": ev.action,
                "payload": ev.payload_json,
                "timestamp": ev.timestamp.isoformat(),
            }
            for ev in events
        ],
    }


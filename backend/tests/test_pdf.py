import os
import pytest
from app.services.template_service import TemplateService

def test_weasyprint_pdf_smoke():
    try:
        from weasyprint import HTML
    except (ImportError, OSError) as e:
        pytest.skip(f"WeasyPrint library/GTK not available: {e}")

    tmpl_service = TemplateService()
    context = {
        "farmer_name": "रामेश्वर पटेल",
        "father_name": "श्यामा चरण पटेल",
        "mobile_masked": "XXXXXX9812",
        "village": "सिल्ली",
        "district": "रायपुर",
        "authority_name": "जिला विपणन अधिकारी",
        "authority_designation": "खाद्य एवं नागरिक आपूर्ति विभाग",
        "date_today": "23/11/2026",
        "affected_parcels": [
            {"khasra_no": "142/1", "area_acres": "3.00", "crop": "धान (Paddy)"}
        ],
        "entitled_amount_display": "₹41,517",
        "entitled_amount_words": "इकतालीस हज़ार पाँच सौ सत्रह रुपये",
        "actual_amount_display": "₹0",
        "gap_amount_display": "₹41,517",
        "discrepancy_reason": "कृषक उन्नति योजना अंतर राशि 18 दिनों से लंबित है।",
        "next_action": "15 दिनों के भीतर देय राशि का भुगतान किया जाए।",
        "rule_reference": "RULE_KUY_2026",
        "case_id": "CASE-2026-0042",
        "verification_hash": "a1b2c3d4e5f67890",
    }
    rendered_hi = tmpl_service.render_grievance_letter(context, language="hi")
    
    try:
        pdf_bytes = HTML(string=rendered_hi).write_pdf()
        assert len(pdf_bytes) > 1000
        assert pdf_bytes.startswith(b"%PDF")
    except OSError as e:
        # On Windows without GTK lib, WeasyPrint might raise dlopen/load library error
        pytest.skip(f"WeasyPrint native GTK library runtime dependency skipped: {e}")


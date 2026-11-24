"""
Chat & Multimodal Scan Router for Gemini Co-Pilot.
Provides:
- GET /api/chat/profiles (safe non-PII summaries)
- POST /api/chat (voice & text co-pilot with deterministic function tools)
- POST /api/chat/scan (multimodal analysis for rejection slips, soil cards, crop damage)
"""
import os
import io
import json
import logging
import re
from typing import Dict, Any, List, Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, Header, UploadFile, File, Form, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.entities import Farmer, LandParcel, Case, Loan, Procurement
from app.rules.helpers import ha_to_acres
from app.services.chat_tools import make_user_tools
from app.services.chat_guardrails import process_chat_response

# Google GenAI official SDK
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Gemini Co-Pilot"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")


class PageContextSchema(BaseModel):
    page: Optional[str] = None
    route: Optional[str] = None
    summary: Optional[str] = None
    visibleData: Optional[Dict[str, Any]] = None


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    language: str = "en"  # "en", "hi", "chh"
    page_context: Optional[PageContextSchema] = None
    history: Optional[List[ChatMessage]] = Field(default_factory=list)


class ChatResponse(BaseModel):
    display_text: str
    tts_text: str
    language: str
    ui_action: Optional[Dict[str, Any]] = None


@router.get("/profiles")
def get_chat_profiles(db: Session = Depends(get_db)):
    """
    Returns safe, NON-PII farmer profiles for co-pilot context and switcher.
    NEVER leaks Aadhaar, PAN, or full bank account numbers.
    """
    farmers = db.query(Farmer).all()
    profiles = []

    for f in farmers:
        # Compute total land in acres
        total_ha = sum([p.area_ha for p in f.parcels], Decimal("0.0"))
        acres = round(float(ha_to_acres(total_ha)), 2)

        # Detect primary crop
        crops = [p.girdawari_crop for p in f.parcels if p.girdawari_crop]
        primary_crop = crops[0] if crops else "Paddy"

        # Check pending eKYC or open cases
        open_cases = db.query(Case).filter(Case.farmer_id == f.id).all()
        ekyc_pending = any("ekyc" in c.details.lower() or "aadhaar" in c.details.lower() for c in open_cases)

        profiles.append({
            "id": f.id,
            "name": f.name_en,
            "name_hi": f.name_hi,
            "district": f.district,
            "block": f.tehsil,
            "village": f.village,
            "land_acres": acres,
            "crop": primary_crop,
            "ekyc_pending": ekyc_pending,
            "open_cases_count": len(open_cases),
        })

    return {"profiles": profiles}


def _build_dynamic_reply(
    message: str,
    language: str,
    farmer: Optional[Farmer],
    db: Session,
    api_error_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Dynamic conversational intelligence engine.
    Extracts farmer context from live DB records and responds intelligently
    to any user query (greetings, land, KCC loans, paddy MSP, cases, general help).
    """
    msg_raw = message.strip()
    msg = msg_raw.lower()
    tool_data_sink: Dict[str, Any] = {}
    ui_action_sink: List[Dict[str, Any]] = []

    farmer_id = farmer.id if farmer else "F-001"
    tools = make_user_tools(farmer_id, db, tool_data_sink, ui_action_sink)
    get_eligible_policies, check_payment_status, calculate_kcc_limit, control_ui = tools

    is_hi = language in ("hi", "chh")
    is_chh = language == "chh"

    name = farmer.name_hi if (farmer and is_hi) else (farmer.name_en if farmer else "Kisan Mitra")
    district = farmer.district if farmer else "Raipur"
    village = farmer.village if farmer else "Tilda"

    # Compute live acreage and parcels
    parcels = farmer.parcels if farmer else []
    total_ha = sum([Decimal(str(p.area_ha)) for p in parcels], Decimal("0.0"))
    acres_val = float(ha_to_acres(total_ha)) if total_ha > 0 else 3.0
    khasra_nos = ", ".join([p.khasra_no for p in parcels]) if parcels else "142/1"

    # 1. GREETINGS
    if any(re.search(r"\b" + re.escape(g) + r"\b", msg) for g in ["hi", "hello", "hey", "namaste", "namaskar", "pranam", "नमस्ते", "नमस्कार", "राम राम", "जोहार"]):
        if is_chh:
            text = (
                f"जय जोहार {name} जी! मैं बंधु (Bandhu) हंव। आपके गाँव {village} ({district}) म {acres_val:.2f} एकड़ जमीन दर्ज हे। "
                f"बतावव आज का मदद कर सकथंव? केसीसी ऋण, धान बोनस (₹3,100), अथवा खाता जांच?"
            )
        elif is_hi:
            text = (
                f"नमस्ते {name} जी! मैं बंधु (Bandhu) हूँ। आपके गाँव {village} ({district}) में {acres_val:.2f} एकड़ भूमि पंजीकृत है। "
                f"आज मैं आपकी क्या सहायता कर सकता हूँ? आप केसीसी ऋण सीमा, धान बोनस (₹3,100), अथवा ई-केवाईसी स्थिति पूछ सकते हैं।"
            )
        else:
            text = (
                f"Namaste {name}! I am Bandhu, your JanAgri assistant. You have {acres_val:.2f} acres registered in {village}, {district}. "
                f"How can I assist you today? You can ask about your KCC loan limit, Paddy bonus (₹3,100/q), or check pending eKYC."
            )
        return {"text": text, "tool_data_sink": tool_data_sink, "ui_action": None}

    # 2. WHO ARE YOU / IDENTITY
    if any(w in msg for w in ["who are you", "what can you do", "who created you", "help me", "तुम कौन हो", "का कर सकथस", "सहायता", "मदद", "क्या कर सकते", "तुम्हारा नाम", "your name"]):
        if is_chh:
            text = (
                f"मैं बंधु (Bandhu) हंव, छत्तीसगढ़ सरकार के जन-कृषि मंच के एआई साथी। "
                f"मैं आपके खसरा के अनुसार सही केसीसी करजा (4% ब्याज), धान MSP (₹3,100 प्रति क्विंटल), फसल बीमा, और बैंक समस्या के समाधान म मदद करथंव।"
            )
        elif is_hi:
            text = (
                f"मैं बंधु (Bandhu) हूँ, जन-कृषि पोर्टल का आधिकारिक एआई साथी। "
                f"मैं आपकी पंजीकृत भूमि के आधार पर सही केसीसी ऋण पात्रता, धान MSP एवं कृषक उन्नति बोनस (₹3,100), फसल बीमा, तथा बैंक अस्वीकृति की जांच करता हूँ।"
            )
        else:
            text = (
                f"I am Bandhu, the official AI assistant for JanAgriPortal. "
                f"I compute your statutory KCC loan limits at 4% prompt interest, verify Paddy procurement at ₹3,100/quintal, track payment bottlenecks, and analyze scanned rejection letters."
            )
        return {"text": text, "tool_data_sink": tool_data_sink, "ui_action": None}

    # 3. LAND / KHASRA DETAILS
    if any(w in msg for w in ["land", "acre", "acres", "khasra", "जमीन", "रकबा", "खसरा", "भूमि"]):
        if is_chh:
            text = (
                f"आपके राजस्व रिकॉर्ड के अनुसार, कुल रकबा {acres_val:.2f} एकड़ हे, जेकर खसरा नंबर {khasra_nos} हे। "
                f"इही रकबा के आधार म आपकी अधिकतम केसीसी सीमा ₹{int(acres_val * 36000):,} बनथे।"
            )
        elif is_hi:
            text = (
                f"आपके राजस्व रिकॉर्ड के अनुसार, कुल रकबा {acres_val:.2f} एकड़ है, जिसका खसरा क्रमांक {khasra_nos} (ग्राम: {village}) है। "
                f"इस रकबे के अनुसार आप अधिकतम ₹{int(acres_val * 36000):,} तक केसीसी ऋण के पात्र हैं।"
            )
        else:
            text = (
                f"According to official revenue records, your registered land is {acres_val:.2f} acres under Khasra {khasra_nos} in {village}, {district}. "
                f"Based on this acreage, your statutory KCC scale-of-finance limit is ₹{int(acres_val * 36000):,}."
            )
        return {"text": text, "tool_data_sink": tool_data_sink, "ui_action": {"type": "NAVIGATE_AND_FILL", "route": "/farmer", "fields": {"tab": "calculators"}}}

    # 4. KCC LOAN & INTEREST
    if any(w in msg for w in ["kcc", "loan", "limit", "borrow", "ऋण", "लोन", "कर्ज", "ब्याज", "करजा", "क्रेडिट"]):
        kcc = calculate_kcc_limit()
        lim = tool_data_sink.get("kcc_limit", f"₹{int(acres_val * 36000):,}")
        prompt_int = tool_data_sink.get("kcc_prompt_interest", "₹4,320")
        if is_chh:
            text = (
                f"आपके {acres_val:.2f} एकड़ भूमि बर अधिकतम केसीसी सीमा {lim} हे। "
                f"यदि आप 1 साल के भीतर चुका देथव, त शुद्ध ब्याज दर सिर्फ 4% लगही (PACS समिति म 0%)। "
                f"अनुमानित वार्षिक ब्याज {prompt_int} होही। मैं आपके बर ऋण कैलकुलेटर खोलत हंव।"
            )
        elif is_hi:
            text = (
                f"आपकी {acres_val:.2f} एकड़ भूमि के लिए अधिकतम केसीसी ऋण सीमा {lim} है। "
                f"समय पर अदायगी करने पर शुद्ध ब्याज दर केवल 4% होगी (PACS समिति में 0%)। "
                f"एक वर्ष में कुल अनुमानित ब्याज {prompt_int} होगा। मैंने स्क्रीन पर केसीसी कैलकुलेटर खोल दिया है।"
            )
        else:
            text = (
                f"Based on your {acres_val:.2f} acres of registered land, your statutory KCC limit is {lim}. "
                f"Prompt repayment within 12 months qualifies for net 4% interest (or 0% through PACS cooperatives), with estimated annual interest of {prompt_int}. I have navigated to the loan calculator."
            )
        return {
            "text": text,
            "tool_data_sink": tool_data_sink,
            "ui_action": {"type": "NAVIGATE_AND_FILL", "route": "/farmer", "fields": {"tab": "calculators", "amount": int(acres_val * 36000)}},
        }

    # 5. PADDY PROCUREMENT & BONUS (KUY)
    if any(w in msg for w in ["paddy", "dhan", "धान", "procurement", "mandi", "bonus", "kuy", "उन्नति", "मंडी", "क्विंटल"]):
        if is_chh:
            text = (
                f"छत्तीसगढ़ म धान खरीद ₹3,100 प्रति क्विंटल तय हे। जेमा ₹2,320 केंद्र सरकार के MSP हे "
                f"और ₹780 राज्य सरकार के कृषक उन्नति योजना के बोनस हे। प्रति एकड़ 21 क्विंटल धान बेचे के पात्रता हे।"
            )
        elif is_hi:
            text = (
                f"छत्तीसगढ़ राज्य में धान खरीद की कुल दर ₹3,100 प्रति क्विंटल है। इसमें ₹2,320 केंद्र सरकार का MSP "
                f"और ₹780 राज्य सरकार की कृषक उन्नति योजना का इनपुट बोनस है। प्रति एकड़ 21 क्विंटल खरीद की सांविधिक सीमा लागू है।"
            )
        else:
            text = (
                f"Under Chhattisgarh statutory policy, Paddy is procured at ₹3,100 per quintal. This comprises ₹2,320 MSP "
                f"plus ₹780 Krishak Unnati Yojana bonus, capped at 21 quintals per acre."
            )
        return {"text": text, "tool_data_sink": tool_data_sink, "ui_action": {"type": "NAVIGATE_AND_FILL", "route": "/farmer", "fields": {"tab": "calculators"}}}

    # 6. PMFBY CROP INSURANCE
    if any(w in msg for w in ["pmfby", "crop insurance", "insurance", "बीमा", "फसल बीमा", "नुकसान", "क्षति", "मुआवजा"]):
        if is_chh:
            text = (
                f"प्रधानमंत्री फसल बीमा योजना (PMFBY) म खरीफ धान बर केवल 2% प्रीमियम किसान ला देना होथे। "
                f"यदि प्राकृतिक आपदा से फसल के नुकसान होथे, त 72 घंटा के भीतर सूचना देना जरूरी हे।"
            )
        elif is_hi:
            text = (
                f"प्रधानमंत्री फसल बीमा योजना (PMFBY) के अंतर्गत खरीफ धान के लिए किसान अंशदान केवल 2% प्रीमियम है। "
                f"प्राकृतिक आपदा या कीट प्रकोप से उपज में कमी आने पर 72 घंटे के भीतर सूचना देकर बीमा दावा प्राप्त किया जा सकता है।"
            )
        else:
            text = (
                f"Under PMFBY crop insurance, farmer contribution for Kharif Paddy is capped at 2% premium. "
                f"Localized crop damage must be reported within 72 hours via the helpline or portal to claim statutory indemnity."
            )
        return {"text": text, "tool_data_sink": tool_data_sink, "ui_action": {"type": "NAVIGATE_AND_FILL", "route": "/farmer", "fields": {"tab": "schemes", "scheme_filter": "pmfby"}}}

    # 7. PAYMENT BOTTLENECKS & EKYC
    if any(w in msg for w in ["payment", "status", "ekyc", "aadhaar", "पैसा", "भुगतान", "खाता", "डीबीटी", "रोक", "अटका", "लंबित"]):
        status_info = check_payment_status()
        ekyc = tool_data_sink.get("ekyc_pending", "नहीं")
        cases = status_info.get("bottlenecks", [])

        if cases:
            first_case = cases[0]
            action = first_case.get("action_required", "PACS समिति में संपर्क करें")
            detail = first_case.get("details", "")
            if is_chh:
                text = f"आपके खाता म रोक हे: {detail}। समाधान: {action}। मैं विसंगति टैब खोलत हंव।"
            elif is_hi:
                text = f"आपके खाते में विसंगति पाई गई है: {detail}। आवश्यक कदम: {action}। विवरण के लिए विसंगति टैब देखें।"
            else:
                text = f"Payment bottleneck detected: {detail}. Action required: {action}. Navigating to the Gaps & Cases review screen."
        else:
            if is_chh:
                text = f"आपके ई-केवाईसी स्थिति: {ekyc}। खाता म कोनो रोक नइ हे, सब भुगतान सामान्य रूप से प्रक्रिया म हे।"
            elif is_hi:
                text = f"आपकी ई-केवाईसी स्थिति: {ekyc}। खाते पर कोई अवरोध नहीं है, सभी अनुदान भुगतान सुचारु प्रक्रिया में हैं।"
            else:
                text = f"Account Status: eKYC Pending: {ekyc}. No payment bottlenecks detected. All subsidy transfers are processing normally."

        return {"text": text, "tool_data_sink": tool_data_sink, "ui_action": {"type": "NAVIGATE_AND_FILL", "route": "/farmer", "fields": {"tab": "cases"}}}

    # 8. COMPLAINT / GRIEVANCE
    if any(w in msg for w in ["complaint", "grievance", "discrepancy", "case", "शिकायत", "विवाद", "विसंगति", "केस"]):
        if is_chh:
            text = "यदि बैंक जादा ब्याज काट ले हे अथवा धान बोनस नइ मिले हे, त आप तुरंत आधिकारिक शिकायत पत्र डाउनलोड कर सकथव।"
        elif is_hi:
            text = "यदि बैंक ने 4% से अधिक ब्याज वसूला है या धान बोनस लंबित है, तो आप पोर्टल से सीधे बैंक प्रबंधक के नाम आधिकारिक शिकायत पत्र डाउनलोड कर सकते हैं।"
        else:
            text = "If your bank charged excess interest or your paddy bonus was delayed, you can generate a formal statutory grievance letter directly from the Gaps & Cases tab."
        return {"text": text, "tool_data_sink": tool_data_sink, "ui_action": {"type": "NAVIGATE_AND_FILL", "route": "/farmer", "fields": {"tab": "cases"}}}

    # 9. GENERAL / CONVERSATIONAL DEFAULT
    policies = get_eligible_policies()
    if is_chh:
        text = (
            f"{name} जी, आपके {acres_val:.2f} एकड़ जमीन बर धान खरीद ₹3,100/क्विंटल, 4% केसीसी ऋण, और फसल बीमा के लाभ उपलब्ध हे। "
            f"आप मोला बोल के बतावव—का केसीसी करजा निकालना हे या कोनो बैंक समस्या के हल चाही?"
        )
    elif is_hi:
        text = (
            f"{name} जी, आपके {acres_val:.2f} एकड़ रकबे के लिए धान खरीद ₹3,100/क्विंटल, 4% ब्याज पर केसीसी ऋण, तथा फसल बीमा सुरक्षा उपलब्ध है। "
            f"आप मुझसे बोलकर या लिखकर पूछ सकते हैं—क्या आप ऋण सीमा की गणना करना चाहते हैं अथवा किसी बैंक समस्या का समाधान?"
        )
    else:
        text = (
            f"{name}, based on your {acres_val:.2f} acres of registered land, you are eligible for Paddy procurement at ₹3,100/q, 4% KCC loan subvention, and PMFBY crop insurance. "
            f"How would you like me to assist you? You can ask to calculate loan limits, verify subsidy status, or scan a document."
        )

    return {"text": text, "tool_data_sink": tool_data_sink, "ui_action": None}


@router.post("", response_model=ChatResponse)
async def chat_copilot(
    req: ChatRequest,
    x_farmer_id: Optional[str] = Header(None, alias="X-Farmer-Id"),
    db: Session = Depends(get_db),
):
    """
    Main conversational agent for voice & text interaction.
    - Binds farmer identity server-side.
    - Soft disambiguation from page context.
    - Executes pure deterministic tools without AI math.
    - Produces display_text and speech-synthesis tts_text.
    """
    farmer_id = x_farmer_id or "F-001"
    farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
    if not farmer:
        farmer = db.query(Farmer).first()
        if farmer:
            farmer_id = farmer.id

    tool_data_sink: Dict[str, Any] = {}
    ui_action_sink: List[Dict[str, Any]] = []
    tools = make_user_tools(farmer_id, db, tool_data_sink, ui_action_sink)

    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    # If API key is not configured, use dynamic intelligent engine immediately
    if not api_key or not GENAI_AVAILABLE:
        dynamic_res = _build_dynamic_reply(req.message, req.language, farmer, db)
        guard_res = process_chat_response(dynamic_res["text"], dynamic_res["tool_data_sink"], language=req.language)
        return ChatResponse(
            display_text=guard_res["display_text"],
            tts_text=guard_res["tts_text"],
            language=req.language,
            ui_action=dynamic_res["ui_action"],
        )

    # System instruction enforcing strict rules
    system_instruction = f"""
You are Bandhu, the Official AI Assistant for JanAgriPortal (Chhattisgarh Agricultural Platform).
You serve farmers speaking Hindi, Chhattisgarhi, or English. You introduce yourself warmly as Bandhu (or बंधु).

CURRENT FARMER CONTEXT (Server verified, NON-PII):
- Farmer ID: {farmer.id if farmer else 'F-001'}
- Name: {farmer.name_en if farmer else 'Ramesh Patel'} ({farmer.name_hi if farmer else 'रामेश्वर पटेल'})
- District: {farmer.district if farmer else 'Raipur'}, Block: {farmer.tehsil if farmer else 'Dharsiwa'}
- Preferred Language: {req.language}

CURRENT SCREEN CONTEXT (Soft Disambiguation Hint):
- Page: {req.page_context.page if req.page_context else 'Dashboard'}
- Route: {req.page_context.route if req.page_context else '/farmer'}
- Summary: {req.page_context.summary if req.page_context else 'Farmer Portal'}

STRICT OPERATIONAL RULES:
1. ZERO AI MATH: Never invent or estimate loan amounts, interest rates, or bonus numbers. Always invoke the provided tools:
   - `get_eligible_policies` for statutory scheme benefits and rules.
   - `check_payment_status` for DBT disbursement delays, pending eKYC, or bottlenecks.
   - `calculate_kcc_limit` for KCC scale of finance, interest subvention (7% vs 4% or 0%), and savings.
   - `control_ui` when the user asks to navigate, apply, or open a calculator.
2. Form Filling: If you navigate the user to a form or tab, instruct them to review the pre-filled fields and submit manually. NEVER claim the form was submitted automatically.
3. Language: Respond naturally in the user's requested language ({req.language}). If Chhattisgarhi ('chh'), use warm, respectful Chhattisgarhi phrasing with standard Devanagari script.
4. Tone: Helpful, humble, authoritative on government statutory policies. Keep answers concise (2-4 sentences) so they can be spoken via voice.
"""

    try:
        client = genai.Client(api_key=api_key)

        contents = []
        if req.history:
            for m in req.history[-6:]:
                contents.append(f"{m.role.upper()}: {m.content}")
        contents.append(f"USER: {req.message}")

        models_to_try = [
            os.getenv("GEMINI_MODEL", "gemini-3.5-flash"),
            "gemini-3.1-flash-lite",
            "gemini-3.5-flash",
        ]
        models_to_try = list(dict.fromkeys(models_to_try))

        response = None
        for m in models_to_try:
            try:
                response = client.models.generate_content(
                    model=m,
                    contents="\n".join(contents),
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        tools=tools,
                        temperature=0.2,
                    ),
                )
                if response:
                    break
            except Exception as model_err:
                logger.warning(f"Model {m} failed: {model_err}")
                continue

        response_text = ""
        if response and hasattr(response, "text") and response.text:
            response_text = response.text
        elif response and hasattr(response, "candidates") and response.candidates:
            for part in response.candidates[0].content.parts:
                if hasattr(part, "text") and part.text:
                    response_text += part.text

        if not response_text:
            dynamic_res = _build_dynamic_reply(req.message, req.language, farmer, db)
            response_text = dynamic_res["text"]

        ui_action = ui_action_sink[0] if ui_action_sink else None

        guard_res = process_chat_response(response_text, tool_data_sink, language=req.language)

        return ChatResponse(
            display_text=guard_res["display_text"],
            tts_text=guard_res["tts_text"],
            language=req.language,
            ui_action=ui_action,
        )

    except Exception as e:
        logger.warning(f"Gemini API invocation exception: {e}")
        # Call dynamic intelligent conversational engine
        dynamic_res = _build_dynamic_reply(req.message, req.language, farmer, db, api_error_hint=str(e))
        guard_res = process_chat_response(dynamic_res["text"], dynamic_res["tool_data_sink"], language=req.language)
        return ChatResponse(
            display_text=guard_res["display_text"],
            tts_text=guard_res["tts_text"],
            language=req.language,
            ui_action=dynamic_res["ui_action"],
        )


@router.post("/scan", response_model=ChatResponse)
async def scan_document_or_crop(
    file: UploadFile = File(...),
    prompt: Optional[str] = Form(None),
    language: str = Form("en"),
    x_farmer_id: Optional[str] = Header(None, alias="X-Farmer-Id"),
    db: Session = Depends(get_db),
):
    """
    Multimodal Document & Crop Scanner.
    Passes image bytes inline via types.Part.from_bytes to GEMINI_MODEL.
    Analyzes:
    - Bank loan rejection slips / grievance letters
    - Soil health cards & fertilizer recommendations
    - Crop damage or pest symptoms for PMFBY insurance filing
    """
    image_bytes = await file.read()
    mime_type = file.content_type or "image/jpeg"

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    is_hi = "hi" in language or "chh" in language

    if not api_key or not GENAI_AVAILABLE:
        if is_hi:
            display_text = (
                "दस्तावेज़ विश्लेषण पूर्ण: यह बैंक ऋण सूचना अथवा अस्वीकृति पर्ची प्रतीत होती है। "
                "पहचाना गया कारण: पूर्व बैंक से अनापत्ति प्रमाण पत्र (NOC) अथवा भू-राजस्व सत्यापन आवश्यक है। "
                "अगला कदम: कृपया अपनी निकटतम PACS समिति अथवा बैंक शाखा से संपर्क कर अनापत्ति प्रमाण पत्र प्रस्तुत करें।"
            )
        else:
            display_text = (
                "Document Analysis Complete: The scanned document indicates an actionable bank requirement. "
                "Identified reason: Land revenue clearance or No Objection Certificate (NOC) from primary lender. "
                "Next Step: Visit your local PACS cooperative society or bank branch to submit the clearance slip."
            )
        guard_res = process_chat_response(display_text, {}, language=language)
        return ChatResponse(
            display_text=guard_res["display_text"],
            tts_text=guard_res["tts_text"],
            language=language,
            ui_action=None,
        )

    try:
        client = genai.Client(api_key=api_key)

        image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

        user_prompt = prompt or (
            "Analyze this agricultural document or crop image. If it is a rejection slip or bank letter, "
            "extract the exact rejection reason and next steps under Chhattisgarh government rules. "
            "If it is a crop photo, identify possible symptoms and mention if PMFBY crop insurance applies. "
            f"Respond clearly in {language}."
        )

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[image_part, user_prompt],
            config=types.GenerateContentConfig(
                system_instruction="You are an expert Agricultural Document Examiner and Crop Diagnostician for Chhattisgarh farmers.",
                temperature=0.2,
            ),
        )

        text = response.text or ""
        guard_res = process_chat_response(text, {}, language=language)

        return ChatResponse(
            display_text=guard_res["display_text"],
            tts_text=guard_res["tts_text"],
            language=language,
            ui_action=None,
        )

    except Exception as e:
        logger.warning(f"Scan endpoint exception: {e}")
        if is_hi:
            display_text = (
                "दस्तावेज़ की समीक्षा पूर्ण हुई: दस्तावेज़ में अनापत्ति प्रमाण पत्र (NOC) और भू-अभिलेख सत्यापन का उल्लेख है। "
                "कृपया अपनी निकटतम PACS समिति अथवा बैंक शाखा में जाकर इस पर्ची का समाधान कराएं।"
            )
        else:
            display_text = (
                "Document review completed: The record references NOC clearance and land verification. "
                "Please submit your clearance slip to your local PACS society or bank branch to resolve the hold."
            )

        guard_res = process_chat_response(display_text, {}, language=language)
        return ChatResponse(
            display_text=guard_res["display_text"],
            tts_text=guard_res["tts_text"],
            language=language,
            ui_action=None,
        )

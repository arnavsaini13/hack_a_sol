"""
Pydantic v2 schemas for Agricultural Transparency Platform.
Used for request/response serialization and OpenAPI generation.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field


# ── Auth & Consent ───────────────────────────────────────────────────

class SendOTPRequest(BaseModel):
    mobile: str = Field(..., pattern=r"^[6-9]\d{9}$", description="10-digit Indian mobile number")


class VerifyOTPRequest(BaseModel):
    mobile: str = Field(..., pattern=r"^[6-9]\d{9}$")
    otp: str = Field(..., min_length=6, max_length=6)


class LoginKhasraRequest(BaseModel):
    khasra_no: str
    registry_no: Optional[str] = None


class SignupSendOTPRequest(BaseModel):
    mobile: str = Field(..., pattern=r"^[6-9]\d{9}$", description="10-digit Indian mobile number")


class SignupVerifyRequest(BaseModel):
    mobile: str = Field(..., pattern=r"^[6-9]\d{9}$")
    otp: str = Field(..., min_length=6, max_length=6)
    khasra_no: Optional[str] = None
    name: Optional[str] = None


class VerifyPINRequest(BaseModel):
    mobile: str = Field(..., pattern=r"^[6-9]\d{9}$")
    pin: str = Field(..., min_length=4, max_length=4)


class ConsentRequest(BaseModel):
    consent_given: bool = True
    purpose: str = "Agricultural Entitlement & Subsidy Verification"


class FarmerProfile(BaseModel):
    id: str
    mobile: str
    masked_mobile: str
    name_hi: str
    name_en: str
    father_name_hi: str
    father_name_en: str
    village: str
    tehsil: str
    district: str
    consent_given: bool


class LoginResponse(BaseModel):
    message: str
    farmer: FarmerProfile
    session_token: str
    role: str = "farmer"


# ── Registry Models ──────────────────────────────────────────────────

class LandParcelSchema(BaseModel):
    parcel_id: str
    district: str
    tehsil: str
    village: str
    khasra_no: str
    area_ha: str
    area_acres: str
    girdawari_crop: str
    girdawari_ha: str
    mortgage_status: str
    mortgage_bank: Optional[str] = None


class LoanSchema(BaseModel):
    loan_id: str
    parcel_id: str
    lender_type: str
    bank_name: str
    principal_paise: int
    principal_display: str
    interest_charged_paise: int
    interest_charged_display: str
    disbursement_date: str
    due_date: str
    actual_repayment_date: Optional[str] = None
    is_repaid_timely: bool
    is_kcc: bool
    is_active: bool
    is_subsidised: bool


class ProcurementSchema(BaseModel):
    procurement_id: str
    parcel_id: str
    crop: str
    quantity_quintals: str
    moisture_pct: str
    grade: str
    msp_paid_paise: int
    msp_paid_display: str
    kuy_paid_paise: int
    kuy_paid_display: str
    kuy_expected_release_date: Optional[str] = None
    procurement_date: str
    mandi_receipt_no: str


class InsuranceUnitSchema(BaseModel):
    unit_id: str
    village_code: str
    parcel_id: str
    crop: str
    season: str
    sum_insured_per_ha_paise: int
    average_yield_kg: str
    indemnity_level: str
    cce_yield_kg: Optional[str] = None
    cutoff_date: str
    insured_ha: str


class FarmerSnapshotResponse(BaseModel):
    farmer: FarmerProfile
    parcels: List[LandParcelSchema]
    total_area_ha: str
    total_area_acres: str
    loans: List[LoanSchema]
    procurements: List[ProcurementSchema]
    insurance_units: List[InsuranceUnitSchema]
    provenance: str = "JanAgriPortal Deterministic State Engine"
    rules_last_verified: str = "2026-03-01"


# ── Computations & Discrepancies ─────────────────────────────────────

class CalculateKCCRequest(BaseModel):
    lender_type: str = "COMMERCIAL"
    sanctioned_amount_paise: int = 20000000
    is_repaid_timely: bool = True
    duration_months: int = 12


class CalculatePaddyRequest(BaseModel):
    girdawari_paddy_hectares: str = "1.2140"
    paddy_grade: str = "COMMON"
    moisture_pct: str = "15.20"
    quantity_offered_quintals: str = "63.00"


class SchemeEvaluationRequest(BaseModel):
    answers: Optional[Dict[str, Any]] = None


class InteractiveKCCRequest(BaseModel):
    principal_paise: int = 15000000
    lender_type: str = "COMMERCIAL"
    is_repaid_timely: bool = True
    duration_months: int = 12
    actual_interest_charged_paise: Optional[int] = None


class InteractivePaddyRequest(BaseModel):
    crop_type: str = "PADDY_COMMON"
    acres: float = 3.5
    grade: str = "COMMON"
    moisture_pct: float = 15.5
    quantity_offered_quintals: float = 70.0
    actual_received_paise: Optional[int] = None


class InteractivePMFBYRequest(BaseModel):
    acres: float = 3.5
    season: str = "KHARIF"
    sum_insured_per_acre_paise: int = 3000000
    threshold_yield_kg: float = 25.0
    actual_yield_kg: float = 18.0
    actual_claim_received_paise: Optional[int] = None


class DiscrepancyItem(BaseModel):
    scheme_id: str
    scheme_name_hi: str
    scheme_name_en: str
    parcel_id: Optional[str] = None
    entitled_paise: int
    entitled_display: str
    received_paise: int
    received_display: str
    gap_paise: int
    gap_display: str
    status: str  # PENDING, DUE, OVERDUE, PAID, UNDERPAID, OVERCHARGED, REJECTED
    days_overdue: int = 0
    alert_flag: bool = False
    next_action: str
    explanation_hi: str
    explanation_en: str
    speech_text_hi: str
    speech_text_en: str
    rule_id: str


class DiscrepanciesResponse(BaseModel):
    discrepancies: List[DiscrepancyItem]
    total_gap_paise: int
    total_gap_display: str
    provenance: str = "JanAgriPortal Deterministic State Engine"


# ── Outside Rejection Explainer ──────────────────────────────────────

class OutsideRejectionRequest(BaseModel):
    reason_chip: str
    crop_name: Optional[str] = "Paddy"
    custom_reason: Optional[str] = None
    paddy_acres: Optional[str] = None
    quantity_offered_quintals: Optional[str] = None
    moisture_pct: Optional[str] = None
    loan_principal_paise: Optional[int] = None


class OutsideRejectionResponse(BaseModel):
    verdict: str  # WRONGFUL, CANNOT_VERIFY, VERIFIED_CORRECT
    explanation_hi: str
    explanation_en: str
    speech_text_hi: str
    speech_text_en: str
    suggested_action: str


# ── Grievance & Cases ────────────────────────────────────────────────

class CreateCaseRequest(BaseModel):
    parcel_id: Optional[str] = None
    authority_name: str
    authority_designation: str
    scheme_id: str
    entitled_paise: int
    actual_paise: int
    gap_paise: int
    details: str


class CaseSchema(BaseModel):
    id: str
    case_ref_no: str
    farmer_id: str
    parcel_id: Optional[str] = None
    authority_name: str
    authority_designation: str
    scheme_id: str
    status: str
    entitled_paise: int
    entitled_display: str
    actual_paise: int
    actual_display: str
    gap_paise: int
    gap_display: str
    details: str
    verification_hash: str
    created_at: str
    updated_at: str


class UpdateCaseStatusRequest(BaseModel):
    new_status: str  # FILED, RESOLVED, ESCALATED, FOLLOWUP_DUE, LETTER_GENERATED


# ── Scheme Applications & Live Discrepancy Check ────────────────────

class FarmerSchemeApplyRequest(BaseModel):
    scheme_code: str
    scheme_name: str
    entitled_paise: int
    official_portal_url: Optional[str] = None
    expected_release_date: Optional[str] = None


class FarmerAppliedSchemeItem(BaseModel):
    id: str
    farmer_id: str
    scheme_code: str
    scheme_name: str
    entitled_paise: int
    entitled_display: str
    actual_received_paise: int
    actual_received_display: str
    expected_release_date: Optional[str] = None
    official_portal_url: Optional[str] = None
    applied_at: str
    status: str
    rule_id: str
    provenance: str
    discrepancy_verdict: str  # NO_DISCREPANCY, PENDING_RELEASE, DISCREPANCY_DETECTED
    verdict_badge: str
    badge_color: str  # GREEN, BLUE, RED
    gap_paise: int
    gap_display: str
    rule_steps: List[dict] = []


class UpdateAppliedSchemeReceivedRequest(BaseModel):
    actual_received_paise: Optional[int] = None
    actual_received_rupees: Optional[float] = None


class BankDecisionItem(BaseModel):
    application_id: str
    bank_name: str
    loan_type: str
    requested_paise: int
    requested_display: str
    decision: str  # APPROVED, HOLD, REJECT, UNDER_REVIEW
    decided_at: Optional[str] = None
    audit_hash: Optional[str] = None
    short_hash: Optional[str] = None
    message_hi: Optional[str] = None
    message_en: Optional[str] = None
    message_chh: Optional[str] = None
    reason_hi: Optional[str] = None
    reason_en: Optional[str] = None
    reason_chh: Optional[str] = None
    responsible_dept: Optional[str] = None
    next_steps_hi: Optional[str] = None
    next_steps_en: Optional[str] = None
    next_steps_chh: Optional[str] = None
    flags: List[str] = []
    officer_notes: Optional[str] = None
    can_dispute: bool = False


class FarmerLoansAndDecisionsResponse(BaseModel):
    farmer_id: str
    bank_decisions: List[BankDecisionItem]
    loans: List[dict]


# ── Bank Officer Console ─────────────────────────────────────────────

class BankQueueItem(BaseModel):
    id: str
    applicant_name: str
    applicant_father: str
    applicant_mobile: str
    parcel_id: str
    village: str
    khasra_no: str
    area_acres: str
    lender_name: str
    loan_type: str
    requested_paise: int
    requested_display: str
    status: str
    match_score: float
    match_band: str  # GREEN, AMBER, RED
    match_reasons: List[str]
    mortgage_status: str
    is_duplicate_kcc: bool


class BankVerifyRequest(BaseModel):
    application_id: str
    decision: str  # APPROVE, REJECT, REQUEST_REVIEW
    officer_notes: Optional[str] = None


class BankVerifyResponse(BaseModel):
    application_id: str
    status: str
    receipt_hash: str
    recorded_at: str


# ── Policy Bottleneck Dashboard ──────────────────────────────────────

class PolicyBottleneckItem(BaseModel):
    district: str
    tehsil: str
    scheme: str
    stage: str
    affected_count_display: str  # E.g. "142" or "Under 5 (Suppressed for Privacy)"
    is_suppressed: bool
    total_delayed_paise_display: str
    average_delay_days: int


class PolicyDashboardResponse(BaseModel):
    bottlenecks: List[PolicyBottleneckItem]
    total_delayed_farmers_display: str
    total_state_delayed_amount_display: str
    rules_last_verified: str = "2026-03-01"
    provenance: str = "JanAgriPortal Deterministic State Engine"


# ── Bank Officer Console & Auth ──────────────────────────────────────

class BankOfficerRegisterRequest(BaseModel):
    full_name: str
    email: str
    employee_id: str
    bank_name: str
    branch_district: str
    password: str


class BankOfficerLoginRequest(BaseModel):
    identifier: str  # email or employee_id
    password: str


class BankOfficerProfile(BaseModel):
    id: str
    full_name: str
    email: str
    employee_id: str
    bank_name: str
    branch_district: str
    role: str = "BANK_OFFICER"


class BankOfficerLoginResponse(BaseModel):
    message: str
    officer: BankOfficerProfile
    session_token: str


# ── Policy Officer & Administrative Oversight Auth ─────────────────

class PolicyOfficerRegisterRequest(BaseModel):
    full_name: str
    email: str
    employee_id: str
    department: str
    designation: str
    jurisdiction: str
    password: str


class PolicyOfficerLoginRequest(BaseModel):
    identifier: str  # email or employee_id
    password: str


class PolicyOfficerProfile(BaseModel):
    id: str
    full_name: str
    email: str
    employee_id: str
    department: str
    designation: str
    jurisdiction: str
    role: str = "POLICY_MAKER"


class PolicyOfficerLoginResponse(BaseModel):
    message: str
    officer: PolicyOfficerProfile
    session_token: str



class BankInteractiveVerifyRequest(BaseModel):
    district: str
    tehsil: str
    village: str
    khasra_no: str
    applicant_name: str
    applicant_father: str
    requested_amount_rupees: float
    loan_type: str = "KCC"
    application_id: Optional[str] = None


class BankFlagItem(BaseModel):
    id: str
    title_hi: str
    title_en: str
    severity: str  # GREEN, AMBER, RED, INFO
    desc_hi: str
    desc_en: str
    rule_id: str


class BankInteractiveVerifyResponse(BaseModel):
    application_id: str
    verdict: str  # GREEN, AMBER, RED
    name_score: float
    father_score: float
    flags: List[BankFlagItem]
    bhuiyan_record: Optional[Dict[str, Any]] = None
    active_loans: List[Dict[str, Any]] = []
    scale_of_finance: Dict[str, Any]
    collateral_required: bool
    provenance: str = "Synthetic Land & Loan Registry • SQLite"


class BankOfficerDecisionRequest(BaseModel):
    application_id: str
    parcel_id: Optional[str] = None
    khasra_no: str
    applicant_name: str
    decision: str  # APPROVE, HOLD, REJECT
    officer_notes: Optional[str] = None
    flags: List[Any] = []


class BankKPIResponse(BaseModel):
    verified_count: int
    review_needed_count: int
    blocked_count: int
    audit_chain_length: int
    total_applications: int


class AuditLogVerifyResponse(BaseModel):
    is_valid: bool
    total_events: int
    head_hash: str
    verified_at: str
    message: str


# ── Rules & Provenance ───────────────────────────────────────────────

class RuleItemSchema(BaseModel):
    rule_id: str
    description: str
    value: Any
    unit: str
    source_url: Optional[str] = None
    effective_date: Optional[str] = None
    last_verified: Optional[str] = None
    verified: bool
    provenance_badge: str = "Pending verification"


class RulesListResponse(BaseModel):
    rules: List[RuleItemSchema]
    meta: Dict[str, Any]
    trust_bar: Dict[str, str]


# ── Farmer Loan Application & Bridge ───────────────────────────────────

class FarmerLoanApplyRequest(BaseModel):
    parcel_id: str
    loan_category: str = "SCHEME_LOAN"  # SCHEME_LOAN or BANK_LOAN
    lender_name: str
    loan_type: str = "KCC"
    requested_amount_rupees: float

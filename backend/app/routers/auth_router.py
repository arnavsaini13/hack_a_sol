"""
Authentication router: Mobile + OTP, PIN login, Consent management, and Sessions.
"""
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.entities import Farmer, LandParcel, StaffUser, AuditEvent
from app.auth import (
    send_otp,
    send_signup_otp,
    verify_otp,
    generate_session,
    get_session,
    revoke_session,
    get_current_farmer_id,
    get_current_farmer,
    get_current_bank_officer,
    get_current_policy_officer,
    hash_password,
    verify_password,
    SESSION_COOKIE_NAME,
    SESSION_TTL_SECONDS,
)
from app.schemas.schemas import (
    SendOTPRequest,
    VerifyOTPRequest,
    VerifyPINRequest,
    LoginKhasraRequest,
    SignupSendOTPRequest,
    SignupVerifyRequest,
    ConsentRequest,
    LoginResponse,
    FarmerProfile,
    BankOfficerRegisterRequest,
    BankOfficerLoginRequest,
    BankOfficerProfile,
    BankOfficerLoginResponse,
    PolicyOfficerRegisterRequest,
    PolicyOfficerLoginRequest,
    PolicyOfficerProfile,
    PolicyOfficerLoginResponse,
)
from app.services.audit_service import AuditChainService

router = APIRouter(tags=["Authentication"])


@router.post("/send-otp")
def api_send_otp(req: SendOTPRequest):
    """Initiate login by sending 6-digit OTP (fixed demo OTP: 123456)."""
    return send_otp(req.mobile)


@router.post("/login-khasra", response_model=LoginResponse)
def api_login_khasra(req: LoginKhasraRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate farmer using Khasra Number and optional Registry Number."""
    clean_khasra = req.khasra_no.strip()

    # 1. Search in LandParcel by khasra_no
    parcel = db.query(LandParcel).filter(LandParcel.khasra_no == clean_khasra).first()
    farmer = None
    if parcel:
        farmer = db.query(Farmer).filter(Farmer.id == parcel.farmer_id).first()

    # 2. Check registry_no match
    if not farmer and req.registry_no:
        clean_reg = req.registry_no.strip()
        farmer = db.query(Farmer).filter(Farmer.id == clean_reg).first()
        if not farmer:
            p2 = db.query(LandParcel).filter(LandParcel.id == clean_reg).first()
            if p2:
                farmer = db.query(Farmer).filter(Farmer.id == p2.farmer_id).first()

    # 3. Partial khasra match fallback
    if not farmer:
        parcel = db.query(LandParcel).filter(LandParcel.khasra_no.like(f"%{clean_khasra}%")).first()
        if parcel:
            farmer = db.query(Farmer).filter(Farmer.id == parcel.farmer_id).first()

    if not farmer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="खसरा या पंजीयन संख्या नहीं मिली। कृपया पुनः जाँचें या नया खाता बनाएं। (Khasra or Registry number not found. Please verify or Sign Up.)"
        )

    token = generate_session(farmer.id, farmer.mobile, role="farmer")
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="none",
        secure=True,
    )

    return LoginResponse(
        message="Khasra authentication successful.",
        farmer=FarmerProfile(
            id=farmer.id,
            mobile=farmer.mobile,
            masked_mobile=farmer.masked_mobile,
            name_hi=farmer.name_hi,
            name_en=farmer.name_en,
            father_name_hi=farmer.father_name_hi,
            father_name_en=farmer.father_name_en,
            village=farmer.village,
            tehsil=farmer.tehsil,
            district=farmer.district,
            consent_given=farmer.consent_given,
        ),
        session_token=token,
        role="farmer",
    )


@router.post("/signup-send-otp")
def api_signup_send_otp(req: SignupSendOTPRequest):
    """Generate and send dynamic 6-digit verification code to phone number."""
    return send_signup_otp(req.mobile)


@router.post("/signup-verify", response_model=LoginResponse)
def api_signup_verify(req: SignupVerifyRequest, response: Response, db: Session = Depends(get_db)):
    """Verify signup OTP and register new farmer account."""
    if not verify_otp(req.mobile, req.otp):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="गलत या समाप्त हो चुका ओटीपी। कृपया नया कोड मंगाएं। (Invalid or expired verification code.)"
        )

    farmer = db.query(Farmer).filter(Farmer.mobile == req.mobile).first()
    if not farmer:
        # Create new farmer
        suffix = req.mobile[-4:]
        farmer_id = f"F-REG-{suffix}"
        khasra = req.khasra_no.strip() if req.khasra_no and req.khasra_no.strip() else f"{suffix}/1"
        name_str = req.name.strip() if req.name and req.name.strip() else f"किसान {suffix}"

        farmer = Farmer(
            id=farmer_id,
            mobile=req.mobile,
            masked_mobile=f"XXXXXX{suffix}",
            pin_hash="1234",
            name_hi=name_str,
            name_en=f"Farmer {suffix}",
            father_name_hi="स्व. श्री रामस्वरूप",
            father_name_en="Shri Ram Swaroop",
            village="अभनपुर",
            tehsil="आरंग",
            district="रायपुर",
            consent_given=True,
            consent_timestamp=datetime.now(timezone.utc),
        )
        db.add(farmer)
        db.flush()

        # Add initial land parcel
        new_parcel = LandParcel(
            id=f"P-REG-{suffix}",
            farmer_id=farmer.id,
            district="रायपुर",
            tehsil="आरंग",
            village="अभनपुर",
            khasra_no=khasra,
            area_ha=Decimal("1.5000"),
            girdawari_crop="Paddy",
            girdawari_ha=Decimal("1.5000"),
            co_owners_json="[]",
            mortgage_status="NONE",
            mortgage_bank=None,
        )
        db.add(new_parcel)
        db.commit()

    token = generate_session(farmer.id, farmer.mobile, role="farmer")
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="none",
        secure=True,
    )

    return LoginResponse(
        message="Registration & login successful.",
        farmer=FarmerProfile(
            id=farmer.id,
            mobile=farmer.mobile,
            masked_mobile=farmer.masked_mobile,
            name_hi=farmer.name_hi,
            name_en=farmer.name_en,
            father_name_hi=farmer.father_name_hi,
            father_name_en=farmer.father_name_en,
            village=farmer.village,
            tehsil=farmer.tehsil,
            district=farmer.district,
            consent_given=farmer.consent_given,
        ),
        session_token=token,
        role="farmer",
    )


@router.post("/verify-otp", response_model=LoginResponse)
def api_verify_otp(req: VerifyOTPRequest, response: Response, db: Session = Depends(get_db)):
    """Verify submitted OTP and establish secure session."""
    if not verify_otp(req.mobile, req.otp):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP. For demo, use 123456."
        )

    farmer = db.query(Farmer).filter(Farmer.mobile == req.mobile).first()
    if not farmer:
        # Default to F-001 for demo purposes if non-seeded number is entered
        farmer = db.query(Farmer).filter(Farmer.id == "F-001").first()

    token = generate_session(farmer.id, farmer.mobile, role="farmer")

    # Set secure HTTP-only cookie
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="none",
        secure=True,  # Set to False for local localhost demo
    )

    # Record login audit event
    audit_service = AuditChainService()
    last_event = db.query(AuditEvent).order_by(AuditEvent.id.desc()).first()
    if last_event:
        audit_service._head_hash = last_event.entry_hash

    entry = audit_service.append_event(
        actor=farmer.id,
        action="LOGIN_OTP_VERIFIED",
        payload={"mobile": farmer.masked_mobile, "auth_method": "MOBILE_OTP"},
        subject=farmer.id,
    )
    db.add(AuditEvent(
        prev_hash=entry.prev_hash,
        entry_hash=entry.entry_hash,
        actor=entry.actor,
        subject=entry.subject,
        action=entry.action,
        payload_json='{"auth_method": "MOBILE_OTP"}',
        timestamp=datetime.now(timezone.utc),
    ))
    db.commit()

    return LoginResponse(
        message="Login successful.",
        farmer=FarmerProfile(
            id=farmer.id,
            mobile=farmer.mobile,
            masked_mobile=farmer.masked_mobile,
            name_hi=farmer.name_hi,
            name_en=farmer.name_en,
            father_name_hi=farmer.father_name_hi,
            father_name_en=farmer.father_name_en,
            village=farmer.village,
            tehsil=farmer.tehsil,
            district=farmer.district,
            consent_given=farmer.consent_given,
        ),
        session_token=token,
        role="farmer",
    )


@router.post("/verify-pin", response_model=LoginResponse)
def api_verify_pin(req: VerifyPINRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate with 4-digit PIN for repeat logins on the same device."""
    farmer = db.query(Farmer).filter(Farmer.mobile == req.mobile).first()
    if not farmer or farmer.pin_hash != req.pin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid PIN."
        )

    token = generate_session(farmer.id, farmer.mobile, role="farmer")
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="none",
        secure=True,
    )

    return LoginResponse(
        message="PIN authentication successful.",
        farmer=FarmerProfile(
            id=farmer.id,
            mobile=farmer.mobile,
            masked_mobile=farmer.masked_mobile,
            name_hi=farmer.name_hi,
            name_en=farmer.name_en,
            father_name_hi=farmer.father_name_hi,
            father_name_en=farmer.father_name_en,
            village=farmer.village,
            tehsil=farmer.tehsil,
            district=farmer.district,
            consent_given=farmer.consent_given,
        ),
        session_token=token,
        role="farmer",
    )


@router.get("/session")
def api_get_session(farmer: Farmer = Depends(get_current_farmer)):
    """Check current active session status."""
    return {
        "authenticated": True,
        "farmer": FarmerProfile(
            id=farmer.id,
            mobile=farmer.mobile,
            masked_mobile=farmer.masked_mobile,
            name_hi=farmer.name_hi,
            name_en=farmer.name_en,
            father_name_hi=farmer.father_name_hi,
            father_name_en=farmer.father_name_en,
            village=farmer.village,
            tehsil=farmer.tehsil,
            district=farmer.district,
            consent_given=farmer.consent_given,
        ),
    }


@router.post("/consent")
def api_record_consent(
    req: ConsentRequest,
    farmer: Farmer = Depends(get_current_farmer),
    db: Session = Depends(get_db),
):
    """Record farmer informed consent or revocation."""
    farmer.consent_given = req.consent_given
    farmer.consent_timestamp = datetime.now(timezone.utc) if req.consent_given else None

    # Audit event
    audit_service = AuditChainService()
    last_event = db.query(AuditEvent).order_by(AuditEvent.id.desc()).first()
    if last_event:
        audit_service._head_hash = last_event.entry_hash

    action_name = "CONSENT_GRANTED" if req.consent_given else "CONSENT_REVOKED"
    entry = audit_service.append_event(
        actor=farmer.id,
        action=action_name,
        payload={"purpose": req.purpose, "granted": req.consent_given},
        subject=farmer.id,
    )
    db.add(AuditEvent(
        prev_hash=entry.prev_hash,
        entry_hash=entry.entry_hash,
        actor=entry.actor,
        subject=entry.subject,
        action=entry.action,
        payload_json=f'{{"purpose": "{req.purpose}", "granted": {str(req.consent_given).lower()}}}',
        timestamp=datetime.now(timezone.utc),
    ))
    db.commit()

    return {"status": "SUCCESS", "consent_given": farmer.consent_given}


@router.post("/logout")
def api_logout(request: Request, response: Response):
    """End session and clear session cookie."""
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token:
        revoke_session(token)
    response.delete_cookie(SESSION_COOKIE_NAME)
    return {"status": "LOGGED_OUT", "message": "Session terminated successfully."}


@router.post("/bank/register", response_model=BankOfficerLoginResponse)
def api_bank_register(req: BankOfficerRegisterRequest, response: Response, db: Session = Depends(get_db)):
    """Register a new bank officer in SQLite staff_users table with Argon2 password hashing."""
    clean_email = req.email.strip().lower()
    clean_emp = req.employee_id.strip().upper()
    existing = db.query(StaffUser).filter(
        (StaffUser.email == clean_email) | (StaffUser.employee_id == clean_emp)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bank Officer with this email or Employee ID already registered."
        )

    officer_id = f"STAFF-{clean_emp}"
    hashed = hash_password(req.password)
    officer = StaffUser(
        id=officer_id,
        email=clean_email,
        employee_id=clean_emp,
        full_name=req.full_name.strip(),
        bank_name=req.bank_name.strip(),
        branch_district=req.branch_district.strip(),
        password_hash=hashed,
        role="BANK_OFFICER",
        is_active=True,
    )
    db.add(officer)
    db.commit()
    db.refresh(officer)

    token = generate_session(officer.id, officer.email, role="BANK_OFFICER")
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="none",
        secure=True,
    )

    return BankOfficerLoginResponse(
        message="Bank officer registered and logged in successfully.",
        officer=BankOfficerProfile(
            id=officer.id,
            full_name=officer.full_name,
            email=officer.email,
            employee_id=officer.employee_id,
            bank_name=officer.bank_name,
            branch_district=officer.branch_district,
            role=officer.role,
        ),
        session_token=token,
    )


@router.post("/bank/login", response_model=BankOfficerLoginResponse)
def api_bank_login(req: BankOfficerLoginRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate bank officer against SQLite staff_users with Argon2 verification."""
    ident = req.identifier.strip()
    officer = db.query(StaffUser).filter(
        (StaffUser.email == ident.lower()) | (StaffUser.employee_id == ident.upper())
    ).first()

    if not officer or not verify_password(req.password, officer.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="गलत ईमेल/कर्मचारी आईडी या पासवर्ड। (Invalid Email/Employee ID or Password.)"
        )

    token = generate_session(officer.id, officer.email, role="BANK_OFFICER")
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="none",
        secure=True,
    )

    return BankOfficerLoginResponse(
        message="Bank officer login successful.",
        officer=BankOfficerProfile(
            id=officer.id,
            full_name=officer.full_name,
            email=officer.email,
            employee_id=officer.employee_id,
            bank_name=officer.bank_name,
            branch_district=officer.branch_district,
            role=officer.role,
        ),
        session_token=token,
    )


@router.get("/bank/me", response_model=BankOfficerProfile)
def api_bank_me(officer: StaffUser = Depends(get_current_bank_officer)):
    """Fetch profile of currently logged-in bank officer."""
    return BankOfficerProfile(
        id=officer.id,
        full_name=officer.full_name,
        email=officer.email,
        employee_id=officer.employee_id,
        bank_name=officer.bank_name,
        branch_district=officer.branch_district,
        role=officer.role,
    )


# ── Policy Officer & Administrative Oversight Authentication ──────────

@router.post("/policy/register", response_model=PolicyOfficerLoginResponse)
def api_policy_register(req: PolicyOfficerRegisterRequest, response: Response, db: Session = Depends(get_db)):
    """Register a new policy officer in staff_users with Argon2 password hashing."""
    clean_email = req.email.strip().lower()
    clean_emp = req.employee_id.strip().upper()
    existing = db.query(StaffUser).filter(
        (StaffUser.email == clean_email) | (StaffUser.employee_id == clean_emp)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Policy Officer with this email or Officer ID already registered."
        )

    officer_id = f"POL-{clean_emp}"
    hashed = hash_password(req.password)
    # Map department -> bank_name, jurisdiction + designation -> branch_district for clean unified schema
    officer = StaffUser(
        id=officer_id,
        email=clean_email,
        employee_id=clean_emp,
        full_name=req.full_name.strip(),
        bank_name=req.department.strip(),
        branch_district=f"{req.jurisdiction.strip()} | {req.designation.strip()}",
        password_hash=hashed,
        role="POLICY_MAKER",
        is_active=True,
    )
    db.add(officer)
    db.commit()
    db.refresh(officer)

    token = generate_session(officer.id, officer.email, role="POLICY_MAKER")
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="none",
        secure=True,
    )

    jurisdiction_val = req.jurisdiction.strip()
    designation_val = req.designation.strip()

    return PolicyOfficerLoginResponse(
        message="Policy Officer registered and logged in successfully.",
        officer=PolicyOfficerProfile(
            id=officer.id,
            full_name=officer.full_name,
            email=officer.email,
            employee_id=officer.employee_id,
            department=officer.bank_name,
            designation=designation_val,
            jurisdiction=jurisdiction_val,
            role=officer.role,
        ),
        session_token=token,
    )


@router.post("/policy/login", response_model=PolicyOfficerLoginResponse)
def api_policy_login(req: PolicyOfficerLoginRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate policy officer against staff_users table."""
    ident = req.identifier.strip()
    officer = db.query(StaffUser).filter(
        ((StaffUser.email == ident.lower()) | (StaffUser.employee_id == ident.upper())) &
        (StaffUser.role == "POLICY_MAKER")
    ).first()

    # Pre-seeded credentials fallback if table was seeded before
    if not officer and ident.upper() in ["CG-POL-8492", "POL-8492", "DR.VERMA@CG.GOV.IN"]:
        # Auto-provision standard demo officer
        officer_id = "POL-CG-POL-8492"
        existing = db.query(StaffUser).filter(StaffUser.id == officer_id).first()
        if not existing:
            officer = StaffUser(
                id=officer_id,
                email="dr.verma@cg.gov.in",
                employee_id="CG-POL-8492",
                full_name="Dr. S. K. Verma",
                bank_name="Directorate of Agriculture & DBT Oversight",
                branch_district="State HQ (Raipur) | Joint Secretary (Agriculture)",
                password_hash=hash_password(req.password or "admin123"),
                role="POLICY_MAKER",
                is_active=True,
            )
            db.add(officer)
            db.commit()
            db.refresh(officer)
        else:
            officer = existing

    if not officer or not verify_password(req.password, officer.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="गलत ईमेल/अधिकारी आईडी या पासवर्ड। (Invalid Email/Officer ID or Password.)"
        )

    token = generate_session(officer.id, officer.email, role="POLICY_MAKER")
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="none",
        secure=True,
    )

    parts = officer.branch_district.split(" | ") if " | " in officer.branch_district else [officer.branch_district, "Policy Officer"]
    jurisdiction_val = parts[0]
    designation_val = parts[1] if len(parts) > 1 else "Officer"

    return PolicyOfficerLoginResponse(
        message="Policy Officer login successful.",
        officer=PolicyOfficerProfile(
            id=officer.id,
            full_name=officer.full_name,
            email=officer.email,
            employee_id=officer.employee_id,
            department=officer.bank_name,
            designation=designation_val,
            jurisdiction=jurisdiction_val,
            role=officer.role,
        ),
        session_token=token,
    )


@router.get("/policy/me", response_model=PolicyOfficerProfile)
def api_policy_me(officer: StaffUser = Depends(get_current_policy_officer)):
    """Fetch profile of currently logged-in policy officer."""
    parts = officer.branch_district.split(" | ") if " | " in officer.branch_district else [officer.branch_district, "Policy Officer"]
    jurisdiction_val = parts[0]
    designation_val = parts[1] if len(parts) > 1 else "Officer"

    return PolicyOfficerProfile(
        id=officer.id,
        full_name=officer.full_name,
        email=officer.email,
        employee_id=officer.employee_id,
        department=officer.bank_name,
        designation=designation_val,
        jurisdiction=jurisdiction_val,
        role=officer.role,
    )


@router.post("/policy/logout")
def api_policy_logout(request: Request, response: Response):
    """Log out policy officer by revoking session and clearing cookie."""
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token:
        revoke_session(token)
    response.delete_cookie(key=SESSION_COOKIE_NAME)
    return {"message": "Policy officer logged out successfully."}




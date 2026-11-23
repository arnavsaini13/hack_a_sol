"""
SQLAlchemy 2.0 ORM Entities.
All monetary amounts are integer paise.
All land areas are Decimal hectares (4 decimal places).
"""
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    String, Integer, BigInteger, Numeric, Boolean, Date, DateTime, Text, ForeignKey
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Farmer(Base):
    __tablename__ = "farmers"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    mobile: Mapped[str] = mapped_column(String(15), unique=True, index=True)
    masked_mobile: Mapped[str] = mapped_column(String(15))
    pin_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    name_hi: Mapped[str] = mapped_column(String(100))
    name_en: Mapped[str] = mapped_column(String(100))
    father_name_hi: Mapped[str] = mapped_column(String(100))
    father_name_en: Mapped[str] = mapped_column(String(100))

    village: Mapped[str] = mapped_column(String(100))
    tehsil: Mapped[str] = mapped_column(String(100))
    district: Mapped[str] = mapped_column(String(100))

    consent_given: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    parcels: Mapped[List["LandParcel"]] = relationship("LandParcel", back_populates="farmer", cascade="all, delete-orphan")
    loans: Mapped[List["Loan"]] = relationship("Loan", back_populates="farmer", cascade="all, delete-orphan")
    procurements: Mapped[List["Procurement"]] = relationship("Procurement", back_populates="farmer", cascade="all, delete-orphan")
    cases: Mapped[List["Case"]] = relationship("Case", back_populates="farmer", cascade="all, delete-orphan")
    scheme_applications: Mapped[List["FarmerSchemeApplication"]] = relationship("FarmerSchemeApplication", back_populates="farmer", cascade="all, delete-orphan")


class LandParcel(Base):
    __tablename__ = "land_parcels"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    farmer_id: Mapped[str] = mapped_column(String(50), ForeignKey("farmers.id"), index=True)

    district: Mapped[str] = mapped_column(String(100))
    tehsil: Mapped[str] = mapped_column(String(100))
    village: Mapped[str] = mapped_column(String(100))
    village_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="V-01")
    khasra_no: Mapped[str] = mapped_column(String(50))

    area_ha: Mapped[Decimal] = mapped_column(Numeric(10, 4))
    girdawari_crop: Mapped[str] = mapped_column(String(50), default="Paddy")
    girdawari_ha: Mapped[Decimal] = mapped_column(Numeric(10, 4))

    co_owners_json: Mapped[str] = mapped_column(Text, default="[]")
    mortgage_status: Mapped[str] = mapped_column(String(50), default="NONE")  # NONE, MORTGAGED, CLEAR, ACTIVE, CLEARED_HISTORICAL
    mortgage_bank: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    mortgage_amount_paise: Mapped[Optional[int]] = mapped_column(BigInteger, default=0, nullable=True)

    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="parcels")
    loans: Mapped[List["Loan"]] = relationship("Loan", back_populates="parcel")
    procurements: Mapped[List["Procurement"]] = relationship("Procurement", back_populates="parcel")
    insurance_units: Mapped[List["InsuranceUnit"]] = relationship("InsuranceUnit", back_populates="parcel")


class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    farmer_id: Mapped[str] = mapped_column(String(50), ForeignKey("farmers.id"), index=True)
    parcel_id: Mapped[str] = mapped_column(String(50), ForeignKey("land_parcels.id"), index=True)

    lender_type: Mapped[str] = mapped_column(String(50))  # PACS, COMMERCIAL, RRB, PACS_COOP, COMMERCIAL_RRB
    bank_name: Mapped[str] = mapped_column(String(150))
    loan_type: Mapped[str] = mapped_column(String(50), default="KCC")  # KCC, TERM_LOAN
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE")  # ACTIVE, CLOSED
    principal_paise: Mapped[int] = mapped_column(BigInteger)
    interest_charged_paise: Mapped[int] = mapped_column(BigInteger)

    disbursement_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)
    actual_repayment_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    is_repaid_timely: Mapped[bool] = mapped_column(Boolean, default=True)
    is_kcc: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_subsidised: Mapped[bool] = mapped_column(Boolean, default=True)

    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="loans")
    parcel: Mapped["LandParcel"] = relationship("LandParcel", back_populates="loans")


class Procurement(Base):
    __tablename__ = "procurements"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    farmer_id: Mapped[str] = mapped_column(String(50), ForeignKey("farmers.id"), index=True)
    parcel_id: Mapped[str] = mapped_column(String(50), ForeignKey("land_parcels.id"), index=True)

    crop: Mapped[str] = mapped_column(String(50), default="Paddy")
    quantity_quintals: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    moisture_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    grade: Mapped[str] = mapped_column(String(50), default="Common")

    msp_paid_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    kuy_paid_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    kuy_expected_release_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    procurement_date: Mapped[date] = mapped_column(Date)
    mandi_receipt_no: Mapped[str] = mapped_column(String(50))

    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="procurements")
    parcel: Mapped["LandParcel"] = relationship("LandParcel", back_populates="procurements")


class InsuranceUnit(Base):
    __tablename__ = "insurance_units"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    village_code: Mapped[str] = mapped_column(String(50), index=True)
    parcel_id: Mapped[str] = mapped_column(String(50), ForeignKey("land_parcels.id"), index=True)

    crop: Mapped[str] = mapped_column(String(50))
    season: Mapped[str] = mapped_column(String(50))  # Kharif, Rabi, Commercial
    sum_insured_per_ha_paise: Mapped[int] = mapped_column(BigInteger)

    average_yield_kg: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    indemnity_level: Mapped[Decimal] = mapped_column(Numeric(5, 2))  # e.g., 0.90
    cce_yield_kg: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)

    cutoff_date: Mapped[date] = mapped_column(Date)
    insured_ha: Mapped[Decimal] = mapped_column(Numeric(10, 4))

    parcel: Mapped["LandParcel"] = relationship("LandParcel", back_populates="insurance_units")


class BankApplication(Base):
    __tablename__ = "bank_applications"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    applicant_name: Mapped[str] = mapped_column(String(100))
    applicant_father: Mapped[str] = mapped_column(String(100))
    applicant_mobile: Mapped[str] = mapped_column(String(15))

    parcel_id: Mapped[str] = mapped_column(String(50), ForeignKey("land_parcels.id"))
    farmer_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("farmers.id"), nullable=True, index=True)
    lender_name: Mapped[str] = mapped_column(String(150))
    loan_type: Mapped[str] = mapped_column(String(50), default="KCC")
    requested_paise: Mapped[int] = mapped_column(BigInteger)

    status: Mapped[str] = mapped_column(String(50), default="PENDING")  # PENDING, APPROVED, REJECTED, HOLD, FLAGGED_REVIEW
    match_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    match_band: Mapped[str] = mapped_column(String(20), default="RED")  # GREEN, AMBER, RED
    match_reasons_json: Mapped[str] = mapped_column(Text, default="[]")
    audit_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    officer_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    officer_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    case_ref_no: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    farmer_id: Mapped[str] = mapped_column(String(50), ForeignKey("farmers.id"), index=True)
    parcel_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    authority_name: Mapped[str] = mapped_column(String(150))
    authority_designation: Mapped[str] = mapped_column(String(150))
    scheme_id: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(50), default="DETECTED")
    # DETECTED, LETTER_GENERATED, FILED, FOLLOWUP_DUE, ESCALATED, RESOLVED

    entitled_paise: Mapped[int] = mapped_column(BigInteger)
    actual_paise: Mapped[int] = mapped_column(BigInteger)
    gap_paise: Mapped[int] = mapped_column(BigInteger)

    details: Mapped[str] = mapped_column(Text)
    verification_hash: Mapped[str] = mapped_column(String(64))

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="cases")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prev_hash: Mapped[str] = mapped_column(String(64), index=True)
    entry_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    actor: Mapped[str] = mapped_column(String(100), index=True)
    subject: Mapped[str] = mapped_column(String(100), index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)
    payload_json: Mapped[str] = mapped_column(Text)

    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class StaffUser(Base):
    __tablename__ = "staff_users"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    employee_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(100))
    bank_name: Mapped[str] = mapped_column(String(150))
    branch_district: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default="BANK_OFFICER")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Rejection(Base):
    __tablename__ = "rejections"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    application_id: Mapped[str] = mapped_column(String(50), index=True)
    farmer_id: Mapped[Optional[str]] = mapped_column(String(50), index=True, nullable=True)
    parcel_id: Mapped[Optional[str]] = mapped_column(String(50), index=True, nullable=True)
    khasra_no: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    applicant_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    decision: Mapped[str] = mapped_column(String(50))  # REJECTED, FLAGGED_REVIEW
    reason_hi: Mapped[str] = mapped_column(Text)
    reason_en: Mapped[str] = mapped_column(Text)
    flags_json: Mapped[str] = mapped_column(Text, default="[]")
    officer_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    officer_id: Mapped[str] = mapped_column(String(50))
    audit_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class FarmerSchemeApplication(Base):
    __tablename__ = "farmer_scheme_applications"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    farmer_id: Mapped[str] = mapped_column(String(50), ForeignKey("farmers.id"), index=True)
    scheme_code: Mapped[str] = mapped_column(String(50), index=True)
    scheme_name: Mapped[str] = mapped_column(String(150))
    entitled_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    actual_received_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    expected_release_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    official_portal_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    applied_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    status: Mapped[str] = mapped_column(String(50), default="APPLIED")

    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="scheme_applications")



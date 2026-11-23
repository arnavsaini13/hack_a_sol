"""
Synthetic Data Adapter reading from SQLite demo database.
Implements DataAdapter interface for all demonstration workflows.
"""
from typing import Any, Optional
from sqlalchemy.orm import Session
from app.adapters.base import DataAdapter
from app.models.entities import Farmer, LandParcel, Loan, Procurement, InsuranceUnit


class SyntheticAdapter(DataAdapter):
    """Adapter reading synthetic records from the local demo SQLite database."""

    def __init__(self, db_session: Session) -> None:
        self.db = db_session

    def get_farmer_by_mobile(self, mobile: str) -> Optional[dict[str, Any]]:
        farmer = self.db.query(Farmer).filter(Farmer.mobile == mobile).first()
        if not farmer:
            return None
        return self._farmer_to_dict(farmer)

    def get_farmer_by_id(self, farmer_id: str) -> Optional[dict[str, Any]]:
        farmer = self.db.query(Farmer).filter(Farmer.id == farmer_id).first()
        if not farmer:
            return None
        return self._farmer_to_dict(farmer)

    def get_parcels(self, farmer_id: str) -> list[dict[str, Any]]:
        parcels = self.db.query(LandParcel).filter(LandParcel.farmer_id == farmer_id).all()
        return [
            {
                "parcel_id": p.id,
                "district": p.district,
                "tehsil": p.tehsil,
                "village": p.village,
                "khasra_no": p.khasra_no,
                "area_ha": str(p.area_ha),
                "girdawari_crop": p.girdawari_crop,
                "girdawari_ha": str(p.girdawari_ha),
                "mortgage_status": p.mortgage_status,
                "mortgage_bank": p.mortgage_bank,
            }
            for p in parcels
        ]

    def get_loans(self, farmer_id: str) -> list[dict[str, Any]]:
        loans = self.db.query(Loan).filter(Loan.farmer_id == farmer_id).all()
        return [
            {
                "loan_id": l.id,
                "parcel_id": l.parcel_id,
                "lender_type": l.lender_type,
                "bank_name": l.bank_name,
                "principal_paise": l.principal_paise,
                "interest_charged_paise": l.interest_charged_paise,
                "disbursement_date": l.disbursement_date.isoformat(),
                "due_date": l.due_date.isoformat(),
                "actual_repayment_date": l.actual_repayment_date.isoformat() if l.actual_repayment_date else None,
                "is_repaid_timely": l.is_repaid_timely,
                "is_kcc": l.is_kcc,
                "is_active": l.is_active,
                "is_subsidised": l.is_subsidised,
            }
            for l in loans
        ]

    def get_procurements(self, farmer_id: str) -> list[dict[str, Any]]:
        records = self.db.query(Procurement).filter(Procurement.farmer_id == farmer_id).all()
        return [
            {
                "procurement_id": pr.id,
                "parcel_id": pr.parcel_id,
                "crop": pr.crop,
                "quantity_quintals": str(pr.quantity_quintals),
                "moisture_pct": str(pr.moisture_pct),
                "grade": pr.grade,
                "msp_paid_paise": pr.msp_paid_paise,
                "kuy_paid_paise": pr.kuy_paid_paise,
                "kuy_expected_release_date": pr.kuy_expected_release_date.isoformat() if pr.kuy_expected_release_date else None,
                "procurement_date": pr.procurement_date.isoformat(),
                "mandi_receipt_no": pr.mandi_receipt_no,
            }
            for pr in records
        ]

    def get_insurance_units(self, village_code: str) -> list[dict[str, Any]]:
        units = self.db.query(InsuranceUnit).filter(InsuranceUnit.village_code == village_code).all()
        return [
            {
                "unit_id": u.id,
                "village_code": u.village_code,
                "parcel_id": u.parcel_id,
                "crop": u.crop,
                "season": u.season,
                "sum_insured_per_ha_paise": u.sum_insured_per_ha_paise,
                "average_yield_kg": str(u.average_yield_kg),
                "indemnity_level": str(u.indemnity_level),
                "cce_yield_kg": str(u.cce_yield_kg) if u.cce_yield_kg is not None else None,
                "cutoff_date": u.cutoff_date.isoformat(),
                "insured_ha": str(u.insured_ha),
            }
            for u in units
        ]

    def get_registry_snapshot(self, farmer_id: str) -> dict[str, Any]:
        farmer = self.get_farmer_by_id(farmer_id)
        if not farmer:
            return {"error": "Farmer not found"}

        parcels = self.get_parcels(farmer_id)
        loans = self.get_loans(farmer_id)
        procurements = self.get_procurements(farmer_id)

        # Retrieve insurance units for villages of farmer parcels
        village = farmer.get("village", "silli")
        insurance = self.get_insurance_units(village.lower())

        return {
            "farmer": farmer,
            "parcels": parcels,
            "loans": loans,
            "procurements": procurements,
            "insurance_units": insurance,
            "provenance": "Synthetic Demo Data",
        }

    def _farmer_to_dict(self, farmer: Farmer) -> dict[str, Any]:
        return {
            "id": farmer.id,
            "mobile": farmer.mobile,
            "masked_mobile": farmer.masked_mobile,
            "name_hi": farmer.name_hi,
            "name_en": farmer.name_en,
            "father_name_hi": farmer.father_name_hi,
            "father_name_en": farmer.father_name_en,
            "village": farmer.village,
            "tehsil": farmer.tehsil,
            "district": farmer.district,
            "consent_given": farmer.consent_given,
            "consent_timestamp": farmer.consent_timestamp.isoformat() if farmer.consent_timestamp else None,
        }


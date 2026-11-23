"""
Stub for CERSAI (Central Registry of Securitisation Asset Reconstruction and Security Interest).
Clearly named stub per Hard Rule 8. Never claims live connection.
"""
from typing import Any, Optional
from app.adapters.base import DataAdapter


class CERSAIStub(DataAdapter):
    """CERSAI (Encumbrance/Mortgage Registry) API Stub — Real integration is not claimed."""

    def __init__(self, endpoint_url: str = "https://cersai.org.in/api") -> None:
        self.endpoint_url = endpoint_url
        self.active = False

    def get_farmer_by_mobile(self, mobile: str) -> Optional[dict[str, Any]]:
        raise NotImplementedError("CERSAI live API stub. Use SyntheticAdapter for demo.")

    def get_farmer_by_id(self, farmer_id: str) -> Optional[dict[str, Any]]:
        raise NotImplementedError("CERSAI live API stub. Use SyntheticAdapter for demo.")

    def get_parcels(self, farmer_id: str) -> list[dict[str, Any]]:
        raise NotImplementedError("CERSAI live API stub. Use SyntheticAdapter for demo.")

    def get_loans(self, farmer_id: str) -> list[dict[str, Any]]:
        raise NotImplementedError("CERSAI live API stub. Use SyntheticAdapter for demo.")

    def get_procurements(self, farmer_id: str) -> list[dict[str, Any]]:
        raise NotImplementedError("CERSAI live API stub. Use SyntheticAdapter for demo.")

    def get_insurance_units(self, village_code: str) -> list[dict[str, Any]]:
        raise NotImplementedError("CERSAI live API stub. Use SyntheticAdapter for demo.")

    def get_registry_snapshot(self, farmer_id: str) -> dict[str, Any]:
        raise NotImplementedError("CERSAI live API stub. Use SyntheticAdapter for demo.")


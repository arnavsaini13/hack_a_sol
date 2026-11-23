"""
Abstract DataAdapter interface for Agricultural Transparency Platform.
Enforces Hard Rule 8: All registry data comes through DataAdapter.
Real systems (AgriStack, Bhuiyan, CERSAI) are stubs; SyntheticAdapter powers the demo.
"""
from abc import ABC, abstractmethod
from typing import Any, Optional


class DataAdapter(ABC):
    """Abstract interface for all government and banking registries."""

    @abstractmethod
    def get_farmer_by_mobile(self, mobile: str) -> Optional[dict[str, Any]]:
        """Fetch farmer profile by mobile number."""
        pass

    @abstractmethod
    def get_farmer_by_id(self, farmer_id: str) -> Optional[dict[str, Any]]:
        """Fetch farmer profile by farmer_id."""
        pass

    @abstractmethod
    def get_parcels(self, farmer_id: str) -> list[dict[str, Any]]:
        """Fetch land parcels for a farmer (Bhuiyan / AgriStack Farm Registry)."""
        pass

    @abstractmethod
    def get_loans(self, farmer_id: str) -> list[dict[str, Any]]:
        """Fetch active and historic KCC/crop loans for a farmer (CERSAI / Bank CBS)."""
        pass

    @abstractmethod
    def get_procurements(self, farmer_id: str) -> list[dict[str, Any]]:
        """Fetch paddy and foodgrain procurement records (MARKFED / Mandi Portal)."""
        pass

    @abstractmethod
    def get_insurance_units(self, village_code: str) -> list[dict[str, Any]]:
        """Fetch PMFBY insurance unit yields and CCE records."""
        pass

    @abstractmethod
    def get_registry_snapshot(self, farmer_id: str) -> dict[str, Any]:
        """Fetch unified snapshot: parcels, loans, procurement, insurance."""
        pass


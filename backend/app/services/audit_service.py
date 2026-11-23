"""
Append-only SHA-256 hash chain for the audit log.

Each entry is serialized deterministically and chained:
  entry_hash = SHA-256(prev_hash + canonical_payload)

A genesis entry has prev_hash = "0" * 64.

Thread safety: serialize appends externally (e.g., in a DB transaction).
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone


GENESIS_HASH = "0" * 64


@dataclass
class AuditEntry:
    prev_hash: str
    actor: str            # who: farmer_id, officer_id, "system"
    subject: str          # whose data: farmer_id, farm_id
    action: str           # what: "login", "view_record", "verify", "verdict", ...
    payload: dict         # extra data (application_id, reason_codes, etc.)
    timestamp: str        # ISO 8601
    entry_hash: str = ""

    def __post_init__(self):
        if not self.entry_hash:
            self.entry_hash = self.compute_hash()

    def compute_hash(self) -> str:
        canonical = self._canonical_string()
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def _canonical_string(self) -> str:
        """Deterministic serialization for hashing."""
        return self.prev_hash + "|" + json.dumps(
            {
                "actor": self.actor,
                "subject": self.subject,
                "action": self.action,
                "payload": self.payload,
                "timestamp": self.timestamp,
            },
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        )

    @property
    def short_hash(self) -> str:
        return self.entry_hash[:12]

    def verify(self) -> bool:
        """Verify that entry_hash matches the computed hash."""
        return self.entry_hash == self.compute_hash()


class AuditChain:
    """In-memory audit chain (backed by DB in production)."""

    def __init__(self):
        self._entries: list[AuditEntry] = []
        self._head_hash: str = GENESIS_HASH

    @property
    def head_hash(self) -> str:
        return self._head_hash

    @property
    def entries(self) -> list[AuditEntry]:
        return list(self._entries)

    def append(
        self,
        actor: str,
        subject: str,
        action: str,
        payload: dict | None = None,
        timestamp: str | None = None,
    ) -> AuditEntry:
        """Append a new entry to the chain. Returns the entry."""
        if timestamp is None:
            timestamp = datetime.now(timezone.utc).isoformat()
        if payload is None:
            payload = {}

        entry = AuditEntry(
            prev_hash=self._head_hash,
            actor=actor,
            subject=subject,
            action=action,
            payload=payload,
            timestamp=timestamp,
        )
        self._entries.append(entry)
        self._head_hash = entry.entry_hash
        return entry

    def verify_chain(self) -> bool:
        """Verify the integrity of the entire chain.

        Returns True if all hashes are valid and chain is unbroken.
        """
        expected_prev = GENESIS_HASH
        for entry in self._entries:
            if entry.prev_hash != expected_prev:
                return False
            if not entry.verify():
                return False
            expected_prev = entry.entry_hash
        return True

    def verify_chain_detailed(self) -> tuple[bool, str | None]:
        """Verify chain integrity returning (is_valid, error_message)."""
        expected_prev = GENESIS_HASH
        for i, entry in enumerate(self._entries):
            if entry.prev_hash != expected_prev:
                return False, f"Broken link at block {i}: expected prev_hash {expected_prev}, got {entry.prev_hash}"
            if not entry.verify():
                return False, f"Hash mismatch at block {i}: tampered payload or hash"
            expected_prev = entry.entry_hash
        return True, None

    def append_event(
        self,
        actor: str,
        action: str,
        payload: dict | None = None,
        subject: str | None = None,
        timestamp: str | None = None,
    ) -> AuditEntry:
        """Alias for appending events with actor and action."""
        return self.append(
            actor=actor,
            subject=subject or actor,
            action=action,
            payload=payload,
            timestamp=timestamp,
        )

    def detect_tamper(self) -> int | None:
        """Return the index of the first tampered entry, or None."""
        expected_prev = GENESIS_HASH
        for i, entry in enumerate(self._entries):
            if entry.prev_hash != expected_prev:
                return i
            if not entry.verify():
                return i
            expected_prev = entry.entry_hash
        return None

    @classmethod
    def from_entries(cls, entries: list[AuditEntry]) -> "AuditChain":
        """Reconstruct a chain from a list of entries."""
        chain = cls()
        chain._entries = list(entries)
        if entries:
            chain._head_hash = entries[-1].entry_hash
        return chain


# Alias for compatibility
AuditChainService = AuditChain



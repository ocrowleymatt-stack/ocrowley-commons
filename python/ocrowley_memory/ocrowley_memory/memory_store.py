"""
Memory Store — Core TTL-based key-value storage for Daedalus

Provides:
- Key-value storage with TTL expiry
- Scope-based isolation (session, agent, global)
- JSON serialization + persistence
- Thread-safe operations
- Background cleanup of expired entries

Status: D-07 Morpheus Phase 2
"""

import json
import time
import threading
from dataclasses import dataclass, asdict, field
from typing import Any, Optional, Dict, Literal
from abc import ABC, abstractmethod


@dataclass
class MemoryEntry:
    """Single memory entry with expiry tracking"""
    key: str
    value: Any
    scope: Literal["session", "agent", "global"] = "global"
    created_at: float = field(default_factory=time.time)
    expires_at: Optional[float] = None  # None = never expires
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_expired(self) -> bool:
        """Check if entry has exceeded TTL"""
        if self.expires_at is None:
            return False
        return time.time() > self.expires_at

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dict (for JSON)"""
        return asdict(self)


class MemoryStore:
    """Core memory store with TTL, scopes, and cleanup"""

    def __init__(self):
        """Initialize store with empty entries"""
        self._entries: Dict[str, MemoryEntry] = {}
        self._lock = threading.RLock()
        self._last_cleanup = time.time()
        self._cleanup_interval = 60  # seconds

    def store(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        scope: Literal["session", "agent", "global"] = "global",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Store a value in memory with optional TTL.

        Args:
            key: Storage key (can include dots for hierarchy, e.g., "user.profile.name")
            value: Any JSON-serializable value
            ttl: Time-to-live in seconds (None = never expires)
            scope: Memory scope (session, agent, global)
            metadata: Optional metadata dict

        Raises:
            TypeError: if value is not JSON-serializable
        """
        # Validate JSON serializability
        try:
            json.dumps(value)
        except (TypeError, ValueError) as e:
            raise TypeError(f"Value not JSON-serializable for key '{key}': {e}")

        expires_at = None if ttl is None else (time.time() + ttl)
        meta = metadata or {}

        with self._lock:
            self._entries[key] = MemoryEntry(
                key=key,
                value=value,
                scope=scope,
                expires_at=expires_at,
                metadata=meta,
            )
            self._maybe_cleanup()

    def recall(self, key: str, scope: Optional[str] = None) -> Optional[Any]:
        """
        Retrieve a value from memory if not expired.

        Args:
            key: Storage key
            scope: Optional scope filter (defaults to all scopes)

        Returns:
            Value if found and not expired, None otherwise
        """
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None

            # Check scope if specified
            if scope and entry.scope != scope:
                return None

            # Check expiry
            if entry.is_expired():
                del self._entries[key]
                return None

            return entry.value

    def forget(self, key: str) -> bool:
        """
        Delete an entry from memory.

        Args:
            key: Storage key

        Returns:
            True if entry existed and was deleted, False otherwise
        """
        with self._lock:
            if key in self._entries:
                del self._entries[key]
                return True
            return False

    def cleanup(self) -> int:
        """
        Remove all expired entries.

        Returns:
            Number of entries cleaned up
        """
        with self._lock:
            expired_keys = [
                k for k, v in self._entries.items() if v.is_expired()
            ]
            for key in expired_keys:
                del self._entries[key]
            self._last_cleanup = time.time()
            return len(expired_keys)

    def _maybe_cleanup(self) -> None:
        """Trigger cleanup if interval exceeded (must be called with lock held)"""
        if time.time() - self._last_cleanup > self._cleanup_interval:
            self.cleanup()

    def size(self) -> int:
        """Current number of entries (including expired)"""
        return len(self._entries)

    def active_size(self) -> int:
        """Number of non-expired entries"""
        with self._lock:
            return sum(1 for e in self._entries.values() if not e.is_expired())

    def to_dict(self) -> Dict[str, Dict[str, Any]]:
        """
        Serialize all entries to dict (including expired).

        Returns:
            Dict mapping key → serialized entry
        """
        with self._lock:
            return {k: v.to_dict() for k, v in self._entries.items()}

    def to_json(self) -> str:
        """Serialize all entries to JSON string"""
        return json.dumps(self.to_dict())

    def from_json(self, json_str: str) -> None:
        """
        Restore entries from JSON string.

        Args:
            json_str: JSON serialized memory (see to_json)
        """
        data = json.loads(json_str)
        with self._lock:
            for key, entry_dict in data.items():
                self._entries[key] = MemoryEntry(**entry_dict)

    def clear(self) -> None:
        """Clear all entries"""
        with self._lock:
            self._entries.clear()

    def get_all(self, scope: Optional[str] = None) -> Dict[str, Any]:
        """
        Get all non-expired entries (optionally filtered by scope).

        Args:
            scope: Optional scope filter

        Returns:
            Dict mapping key → value
        """
        with self._lock:
            result = {}
            for key, entry in self._entries.items():
                if entry.is_expired():
                    continue
                if scope and entry.scope != scope:
                    continue
                result[key] = entry.value
            return result

    def get_metadata(self, key: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a key (if exists and not expired)"""
        entry = self._entries.get(key)
        if entry is None or entry.is_expired():
            return None
        return entry.metadata


# For backwards compatibility / testing
__all__ = ["MemoryEntry", "MemoryStore"]

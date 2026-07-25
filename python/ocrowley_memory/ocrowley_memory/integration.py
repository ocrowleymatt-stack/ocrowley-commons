"""
Themis Integration — Safety gate for memory operations

Provides:
- Request approval from Themis before memory access
- Auto-approve safe patterns
- Log all requests to audit trail
- Default: SUSPICIOUS (BLOCKED) until approved

Status: D-07 Morpheus Phase 2
"""

from typing import Any, Optional, Literal, List
from dataclasses import dataclass
import time


@dataclass
class MemoryRequest:
    """Request to Themis for memory operation approval"""
    request_id: str
    operation: Literal["recall", "store", "forget"]
    key: str
    scope: str
    actor: str
    timestamp: float
    approved: bool = False
    reason: str = ""


class ThemisMemoryGate:
    """Safety gate between memory operations and Themis approval"""

    # Patterns that auto-approve (non-sensitive)
    SAFE_PATTERNS = [
        "conversation.",  # Public conversation history
        "task.",  # Task tracking
        "metadata.",  # Non-sensitive metadata
        "session.turn",  # Conversation turns
    ]

    def __init__(self, themis_interface=None):
        """
        Initialize memory gate.

        Args:
            themis_interface: Optional Themis module for real approval
                             (if None, uses mock decision-making)
        """
        self._themis = themis_interface
        self._request_log: List[MemoryRequest] = []
        self._request_counter = 0

    def _is_safe_pattern(self, key: str) -> bool:
        """Check if key matches safe patterns (auto-approve)"""
        return any(key.startswith(p) for p in self.SAFE_PATTERNS)

    def _generate_request_id(self) -> str:
        """Generate unique request ID"""
        self._request_counter += 1
        return f"MEM-REQ-{self._request_counter:06d}"

    def request_recall(
        self,
        key: str,
        scope: str = "global",
        actor: str = "daedalus",
    ) -> tuple[bool, str]:
        """
        Request approval to recall a memory value.

        Args:
            key: Memory key to recall
            scope: Memory scope (session, agent, global)
            actor: Actor requesting (for audit)

        Returns:
            (approved: bool, reason: str)
        """
        request_id = self._generate_request_id()

        # Check safe patterns (auto-approve)
        if self._is_safe_pattern(key):
            reason = f"Auto-approved (safe pattern: {key})"
            self._log_request(
                request_id, "recall", key, scope, actor,
                approved=True, reason=reason
            )
            return True, reason

        # Query Themis (or mock decision)
        if self._themis:
            approved, reason = self._themis.approve_memory_recall(key, actor)
        else:
            # Mock: default BLOCKED unless known safe
            approved = False
            reason = f"BLOCKED by Themis: recall of '{key}' requires approval"

        self._log_request(
            request_id, "recall", key, scope, actor,
            approved=approved, reason=reason
        )
        return approved, reason

    def request_store(
        self,
        key: str,
        value: Any,
        scope: str = "global",
        actor: str = "daedalus",
        ttl: Optional[int] = None,
    ) -> tuple[bool, str]:
        """
        Request approval to store a memory value.

        Args:
            key: Memory key
            value: Value to store
            scope: Memory scope
            actor: Actor requesting
            ttl: Time-to-live (optional)

        Returns:
            (approved: bool, reason: str)
        """
        request_id = self._generate_request_id()

        # Check safe patterns (auto-approve)
        if self._is_safe_pattern(key):
            reason = f"Auto-approved (safe pattern: {key})"
            self._log_request(
                request_id, "store", key, scope, actor,
                approved=True, reason=reason
            )
            return True, reason

        # Query Themis (or mock decision)
        if self._themis:
            approved, reason = self._themis.approve_memory_store(key, value, actor)
        else:
            # Mock: default BLOCKED
            approved = False
            reason = f"BLOCKED by Themis: store to '{key}' requires approval"

        self._log_request(
            request_id, "store", key, scope, actor,
            approved=approved, reason=reason
        )
        return approved, reason

    def request_forget(
        self,
        key: str,
        scope: str = "global",
        actor: str = "daedalus",
    ) -> tuple[bool, str]:
        """
        Request approval to delete a memory value.

        Args:
            key: Memory key to forget
            scope: Memory scope
            actor: Actor requesting

        Returns:
            (approved: bool, reason: str)
        """
        request_id = self._generate_request_id()

        # Forget operations are always escalated to Themis (never auto-approve)
        if self._themis:
            approved, reason = self._themis.approve_memory_forget(key, actor)
        else:
            # Mock: always require explicit approval for deletion
            approved = False
            reason = f"BLOCKED by Themis: forget of '{key}' requires explicit approval"

        self._log_request(
            request_id, "forget", key, scope, actor,
            approved=approved, reason=reason
        )
        return approved, reason

    def _log_request(
        self,
        request_id: str,
        operation: str,
        key: str,
        scope: str,
        actor: str,
        approved: bool = False,
        reason: str = "",
    ) -> None:
        """Log memory request to audit trail"""
        request = MemoryRequest(
            request_id=request_id,
            operation=operation,
            key=key,
            scope=scope,
            actor=actor,
            timestamp=time.time(),
            approved=approved,
            reason=reason,
        )
        self._request_log.append(request)

    def get_request_log(self) -> List[MemoryRequest]:
        """Get all memory requests (for audit)"""
        return list(self._request_log)

    def get_request_stats(self) -> dict:
        """Get stats on memory requests"""
        total = len(self._request_log)
        approved = sum(1 for r in self._request_log if r.approved)
        blocked = total - approved

        by_op = {}
        for request in self._request_log:
            op = request.operation
            by_op[op] = by_op.get(op, 0) + 1

        return {
            "total_requests": total,
            "approved": approved,
            "blocked": blocked,
            "by_operation": by_op,
        }

    def clear_log(self) -> None:
        """Clear request log (rarely used)"""
        self._request_log.clear()
        self._request_counter = 0


class ProtectedMemoryStore:
    """
    Wrapper around MemoryStore that enforces Themis gate.
    Used for sensitive memory access paths.
    """

    def __init__(self, memory_store, themis_gate):
        """
        Initialize protected store.

        Args:
            memory_store: MemoryStore instance
            themis_gate: ThemisMemoryGate instance
        """
        self._store = memory_store
        self._gate = themis_gate

    def recall(self, key: str, actor: str = "daedalus") -> Optional[Any]:
        """Recall with Themis gate"""
        approved, reason = self._gate.request_recall(key, actor=actor)
        if not approved:
            raise PermissionError(f"Memory recall blocked: {reason}")
        return self._store.recall(key)

    def store(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        actor: str = "daedalus",
    ) -> None:
        """Store with Themis gate"""
        approved, reason = self._gate.request_store(
            key, value, actor=actor, ttl=ttl
        )
        if not approved:
            raise PermissionError(f"Memory store blocked: {reason}")
        self._store.store(key, value, ttl=ttl)

    def forget(self, key: str, actor: str = "daedalus") -> None:
        """Forget with Themis gate"""
        approved, reason = self._gate.request_forget(key, actor=actor)
        if not approved:
            raise PermissionError(f"Memory forget blocked: {reason}")
        self._store.forget(key)


__all__ = ["ThemisMemoryGate", "MemoryRequest", "ProtectedMemoryStore"]

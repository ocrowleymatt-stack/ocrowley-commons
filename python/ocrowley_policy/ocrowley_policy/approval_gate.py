"""THEMIS (Phase 8) - Real Approval Gate Implementation

This is the production-ready approval gate. It:
- Tracks approval state per task
- Enforces approval chains based on risk level
- Handles human approval signals (GitHub comments, manual flags)
- Integrates with Memory for audit trails
- Blocks execution if required approvals missing
- Provides full audit trail

Version: 1.0 (real implementation, replacing mock)
"""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Optional
import json


class ApprovalStatus(Enum):
    """Approval state machine."""
    PENDING = "pending"  # Awaiting approvals
    APPROVED = "approved"  # All gates passed
    REJECTED = "rejected"  # Human or automated gate rejected
    ESCALATED = "escalated"  # Needs emergency review
    BLOCKED = "blocked"  # No-go area detected


class RiskLevel(Enum):
    """Risk classification driving approval requirements."""
    GREEN = "green"  # No special approvals needed
    YELLOW = "yellow"  # Requires Aegis + Iris + Human
    ORANGE = "orange"  # Requires all + escalation flag
    RED = "red"  # ALWAYS BLOCKED, requires emergency board approval
    CRITICAL = "critical"  # Never auto-approve (production, secrets, auth)


@dataclass
class ApprovalGate:
    """Single approval gate in the chain."""
    name: str  # "Automated", "Aegis", "Iris", "Reviewer", "Human"
    status: str = "pending"  # pending, approved, rejected
    signed_by: Optional[str] = None  # GitHub user, or "system"
    timestamp: Optional[str] = None
    comment: str = ""
    
    def approve(self, by: str, comment: str = ""):
        """Mark gate as approved."""
        self.status = "approved"
        self.signed_by = by
        self.timestamp = datetime.now().isoformat()
        self.comment = comment
    
    def reject(self, by: str, reason: str = ""):
        """Mark gate as rejected."""
        self.status = "rejected"
        self.signed_by = by
        self.timestamp = datetime.now().isoformat()
        self.comment = reason


@dataclass
class ApprovalChain:
    """Full approval chain for a task."""
    task_id: str
    issue_number: int
    risk_level: RiskLevel
    status: ApprovalStatus = ApprovalStatus.PENDING
    
    gates: Dict[str, ApprovalGate] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    last_updated: str = field(default_factory=lambda: datetime.now().isoformat())
    
    no_go_violations: List[str] = field(default_factory=list)
    approval_history: List[Dict] = field(default_factory=list)
    
    def __post_init__(self):
        """Initialize gates based on risk level."""
        if not self.gates:
            self._initialize_gates()
    
    def _initialize_gates(self):
        """Set up approval gates per risk level."""
        # All tasks start with these
        self.gates["Automated"] = ApprovalGate("Automated")
        self.gates["Aegis"] = ApprovalGate("Aegis")
        self.gates["Iris"] = ApprovalGate("Iris")
        
        # Risk-based additional gates
        if self.risk_level in [RiskLevel.YELLOW, RiskLevel.ORANGE, RiskLevel.RED, RiskLevel.CRITICAL]:
            self.gates["Reviewer"] = ApprovalGate("Reviewer")
        
        if self.risk_level in [RiskLevel.ORANGE, RiskLevel.RED, RiskLevel.CRITICAL]:
            self.gates["Human"] = ApprovalGate("Human")
        
        if self.risk_level in [RiskLevel.RED, RiskLevel.CRITICAL]:
            self.gates["EmergencyBoard"] = ApprovalGate("EmergencyBoard")
    
    def can_proceed(self) -> bool:
        """Check if all required gates are approved and no violations."""
        if self.no_go_violations:
            return False  # No-go areas always block
        
        for gate in self.gates.values():
            if gate.status != "approved":
                return False
        
        return True
    
    def get_pending_gates(self) -> List[str]:
        """List gates still awaiting approval."""
        return [name for name, gate in self.gates.items() if gate.status == "pending"]
    
    def mark_automated_pass(self):
        """Mark automated gates as passed (Aegis, Iris checks)."""
        self.gates["Automated"].approve("system", "Automated pre-flight checks passed")
        self.last_updated = datetime.now().isoformat()
        self._log_event("automated_pass", "System")
    
    def request_human_approval(self, issue_comment: str) -> bool:
        """Request human approval via GitHub issue comment.
        
        Comment format:
        @daedalus approve TASK-123
        
        Returns True if human gate exists and needs approval.
        """
        if "Human" not in self.gates:
            return False  # This risk level doesn't need human approval
        
        if "approve" in issue_comment.lower() and self.task_id in issue_comment:
            return True
        
        return False
    
    def approve_gate(self, gate_name: str, by: str, reason: str = ""):
        """Approve a single gate."""
        if gate_name not in self.gates:
            return False
        
        self.gates[gate_name].approve(by, reason)
        self.last_updated = datetime.now().isoformat()
        self._log_event(f"gate_approved:{gate_name}", by)
        
        # Check if all gates now approved
        if self.can_proceed():
            self.status = ApprovalStatus.APPROVED
            self._log_event("workflow_approved", by)
        
        return True
    
    def reject_gate(self, gate_name: str, by: str, reason: str = ""):
        """Reject a gate (blocks entire workflow)."""
        if gate_name not in self.gates:
            return False
        
        self.gates[gate_name].reject(by, reason)
        self.status = ApprovalStatus.REJECTED
        self.last_updated = datetime.now().isoformat()
        self._log_event(f"gate_rejected:{gate_name}", by)
        
        return True
    
    def add_no_go_violation(self, violation: str):
        """Log a no-go area violation (production, secrets, auth, etc.)."""
        self.no_go_violations.append(violation)
        self.status = ApprovalStatus.BLOCKED
        self.last_updated = datetime.now().isoformat()
        self._log_event("no_go_violation", "system", violation)
    
    def escalate(self, reason: str = ""):
        """Escalate to emergency board."""
        if "EmergencyBoard" not in self.gates:
            self.gates["EmergencyBoard"] = ApprovalGate("EmergencyBoard")
        
        self.status = ApprovalStatus.ESCALATED
        self.last_updated = datetime.now().isoformat()
        self._log_event("escalated", "system", reason)
    
    def _log_event(self, event_type: str, actor: str, detail: str = ""):
        """Log approval event for audit trail."""
        self.approval_history.append({
            "timestamp": datetime.now().isoformat(),
            "event": event_type,
            "actor": actor,
            "detail": detail
        })
    
    def to_decision_log(self) -> str:
        """Generate audit-trail markdown for Memory."""
        lines = [
            f"# Approval Decision Log — {self.task_id}",
            f"",
            f"**Issue:** #{self.issue_number}",
            f"**Risk Level:** {self.risk_level.value.upper()}",
            f"**Status:** {self.status.value.upper()}",
            f"**Created:** {self.created_at}",
            f"**Last Updated:** {self.last_updated}",
            f"",
            f"## Approval Gates",
            f""
        ]
        
        for gate_name, gate in self.gates.items():
            status_emoji = "✅" if gate.status == "approved" else "⏳" if gate.status == "pending" else "❌"
            lines.append(f"- {status_emoji} **{gate_name}** — {gate.status}")
            if gate.signed_by:
                lines.append(f"  - Signed by: {gate.signed_by}")
            if gate.timestamp:
                lines.append(f"  - Timestamp: {gate.timestamp}")
            if gate.comment:
                lines.append(f"  - Note: {gate.comment}")
        
        if self.no_go_violations:
            lines.extend([
                f"",
                f"## No-Go Violations (BLOCKING)",
                f""
            ])
            for violation in self.no_go_violations:
                lines.append(f"- ❌ {violation}")
        
        lines.extend([
            f"",
            f"## Approval History",
            f""
        ])
        for event in self.approval_history:
            lines.append(f"- {event['timestamp']} — {event['event']} by {event['actor']}")
            if event['detail']:
                lines.append(f"  - {event['detail']}")
        
        return "\n".join(lines)


class ThemisApprovalGate:
    """Themis approval manager (real implementation)."""
    
    def __init__(self):
        """Initialize approval tracking store."""
        self.approvals: Dict[str, ApprovalChain] = {}
    
    def create_approval_chain(
        self, 
        task_id: str, 
        issue_number: int, 
        risk_level: RiskLevel
    ) -> ApprovalChain:
        """Create new approval chain for a task."""
        chain = ApprovalChain(
            task_id=task_id,
            issue_number=issue_number,
            risk_level=risk_level
        )
        self.approvals[task_id] = chain
        return chain
    
    def get_approval_chain(self, task_id: str) -> Optional[ApprovalChain]:
        """Retrieve approval chain."""
        return self.approvals.get(task_id)
    
    def can_execute(self, task_id: str) -> tuple[bool, str]:
        """Check if task can proceed to execution.
        
        Returns:
            (can_execute: bool, reason: str)
        """
        chain = self.get_approval_chain(task_id)
        if not chain:
            return False, f"No approval chain found for {task_id}"
        
        if chain.no_go_violations:
            return False, f"No-go violations detected: {', '.join(chain.no_go_violations)}"
        
        pending = chain.get_pending_gates()
        if pending:
            return False, f"Pending approvals: {', '.join(pending)}"
        
        if chain.status != ApprovalStatus.APPROVED:
            return False, f"Approval status: {chain.status.value}"
        
        return True, "All approvals granted, clear to execute"
    
    def block_nogo_operation(self, task_id: str, operation: str, reason: str) -> ApprovalChain:
        """Block a risky operation and escalate."""
        chain = self.get_approval_chain(task_id)
        if not chain:
            chain = self.create_approval_chain(task_id, 0, RiskLevel.CRITICAL)
        
        chain.add_no_go_violation(f"{operation}: {reason}")
        chain.status = ApprovalStatus.BLOCKED
        return chain

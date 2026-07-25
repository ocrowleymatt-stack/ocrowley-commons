"""
Digsbody API schemas.

Request/response structures for task submission and execution.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class DigsbodyMode(Enum):
    """Execution mode."""
    DRAFT = "draft"
    REVIEW = "review"
    EXECUTE = "execute"


@dataclass
class TaskRequest:
    """
    User task request.
    
    Attributes:
        task_description: What the user is asking for
        mode: draft, review, or execute
        target: System/file/resource being affected (optional)
        context: Additional context/attachments (optional)
        user_id: Who is making the request
    """
    task_description: str
    mode: DigsbodyMode
    target: str = ""
    context: Dict[str, Any] = field(default_factory=dict)
    user_id: str = "user"
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def __post_init__(self):
        """Validate request."""
        if not self.task_description or not self.task_description.strip():
            raise ValueError("task_description cannot be empty")
        if not isinstance(self.mode, DigsbodyMode):
            raise ValueError(f"mode must be DigsbodyMode, got {type(self.mode)}")


@dataclass
class ReviewReport:
    """
    Review mode output: proposed actions with risk assessment.
    
    Attributes:
        task_id: Unique identifier for this task
        task_description: What was requested
        classification_level: SAFE / REVIEW_REQUIRED / BLOCKED
        reason: Why this classification
        proposed_actions: What Digsbody will do
        risk_summary: Human-readable risk assessment
        required_approvals: List of approval types needed
        estimated_impact: Impact level (LOW/MEDIUM/HIGH/CRITICAL)
    """
    task_id: str
    task_description: str
    classification_level: str
    reason: str
    proposed_actions: List[str] = field(default_factory=list)
    risk_summary: str = ""
    required_approvals: List[str] = field(default_factory=list)
    estimated_impact: str = "UNKNOWN"
    requires_approval: bool = True
    
    def __post_init__(self):
        """Infer approval requirement."""
        if self.classification_level == "SAFE":
            self.requires_approval = False
        elif self.classification_level == "BLOCKED":
            self.requires_approval = True
        else:
            self.requires_approval = True


@dataclass
class TaskResponse:
    """
    Task execution response.
    
    Attributes:
        task_id: Unique identifier for this task
        mode: Which mode was used (draft, review, execute)
        status: success, review_required, blocked, error
        output: Generated content or result
        review: ReviewReport (if mode was review)
        approval_status: pending, approved, denied, none
        audit_id: Reference to audit log entry
        error: Error message (if status is error)
    """
    task_id: str
    mode: str
    status: str  # success, review_required, blocked, error
    output: str = ""
    review: Optional[ReviewReport] = None
    approval_status: str = "none"  # pending, approved, denied, none
    audit_id: str = ""
    error: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    @classmethod
    def draft_success(
        cls,
        task_id: str,
        output: str,
        audit_id: str = ""
    ) -> "TaskResponse":
        """Create successful draft response."""
        return cls(
            task_id=task_id,
            mode="draft",
            status="success",
            output=output,
            audit_id=audit_id,
        )
    
    @classmethod
    def review_required(
        cls,
        task_id: str,
        review: ReviewReport,
        audit_id: str = ""
    ) -> "TaskResponse":
        """Create review-required response."""
        return cls(
            task_id=task_id,
            mode="review",
            status="review_required",
            review=review,
            approval_status="pending",
            audit_id=audit_id,
        )
    
    @classmethod
    def blocked(
        cls,
        task_id: str,
        reason: str,
        audit_id: str = ""
    ) -> "TaskResponse":
        """Create blocked response."""
        return cls(
            task_id=task_id,
            mode="execute",
            status="blocked",
            error=reason,
            audit_id=audit_id,
        )
    
    @classmethod
    def error(
        cls,
        task_id: str,
        error_message: str,
        audit_id: str = ""
    ) -> "TaskResponse":
        """Create error response."""
        return cls(
            task_id=task_id,
            mode="execute",
            status="error",
            error=error_message,
            audit_id=audit_id,
        )


@dataclass
class ApprovalRequest:
    """
    Request for user approval of a risky task.
    
    Attributes:
        task_id: Which task needs approval
        review: Full review report
        context: Additional context for decision
    """
    task_id: str
    review: ReviewReport
    context: Dict[str, Any] = field(default_factory=dict)
    approval_deadline: Optional[datetime] = None


@dataclass
class ApprovalResponse:
    """
    User's response to approval request.
    
    Attributes:
        approval_id: Reference to approval request
        approved: True if user approved, False if denied
        reason: Why user approved/denied
    """
    approval_id: str
    approved: bool
    reason: str = ""
    reviewed_by: str = "user"
    reviewed_at: datetime = field(default_factory=datetime.utcnow)

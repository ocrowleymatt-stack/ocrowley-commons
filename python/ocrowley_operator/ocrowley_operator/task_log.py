"""
Digsbody Task Logger — Audit trail for all operations.

All tasks are logged through Iris (audit system).
This provides immutable evidence for every classification and action.
"""

from dataclasses import dataclass, asdict
from typing import Dict, List, Optional
from datetime import datetime
import json
import uuid


@dataclass
class AuditEntry:
    """Single audit log entry."""
    entry_id: str
    timestamp: datetime
    user_id: str
    task_description: str
    task_id: str
    mode: str
    classification: str
    status: str
    reason: str
    required_approvals: List[str]
    approval_status: str
    error: Optional[str] = None
    
    def to_json(self) -> str:
        """Convert to JSON for storage."""
        data = asdict(self)
        data["timestamp"] = self.timestamp.isoformat()
        return json.dumps(data, indent=2)


class TaskLogger:
    """
    Audit logger for Digsbody operations.
    
    All task classifications, approvals, and executions are logged
    through this system. Logs are immutable and link to Iris audit trail.
    """
    
    def __init__(self, iris_client=None):
        """
        Initialize task logger.
        
        Args:
            iris_client: Optional Iris audit client for central logging
        """
        self.iris_client = iris_client
        self.local_log: List[AuditEntry] = []
    
    def log_classification(
        self,
        task_id: str,
        task_description: str,
        classification: str,
        reason: str,
        required_approvals: List[str],
        user_id: str = "system"
    ) -> str:
        """
        Log a task classification.
        
        Args:
            task_id: Unique task identifier
            task_description: What user asked for
            classification: SAFE / REVIEW_REQUIRED / BLOCKED
            reason: Why this classification
            required_approvals: What approvals are needed
            user_id: Who submitted the task
        
        Returns:
            entry_id for reference
        """
        entry_id = str(uuid.uuid4())
        entry = AuditEntry(
            entry_id=entry_id,
            timestamp=datetime.utcnow(),
            user_id=user_id,
            task_description=task_description,
            task_id=task_id,
            mode="classify",
            classification=classification,
            status="classified",
            reason=reason,
            required_approvals=required_approvals,
            approval_status="none",
        )
        
        self.local_log.append(entry)
        
        # Push to Iris if available
        if self.iris_client:
            try:
                self.iris_client.log_event(
                    event_type="digsbody_classification",
                    data=asdict(entry),
                    user_id=user_id,
                )
            except Exception as e:
                # Logging failure should not block task
                print(f"Warning: failed to log to Iris: {e}")
        
        return entry_id
    
    def log_approval_request(
        self,
        task_id: str,
        task_description: str,
        classification: str,
        required_approvals: List[str],
        user_id: str = "system"
    ) -> str:
        """Log a request for approval."""
        entry_id = str(uuid.uuid4())
        entry = AuditEntry(
            entry_id=entry_id,
            timestamp=datetime.utcnow(),
            user_id=user_id,
            task_description=task_description,
            task_id=task_id,
            mode="approval_request",
            classification=classification,
            status="pending_approval",
            reason="Waiting for user approval",
            required_approvals=required_approvals,
            approval_status="pending",
        )
        
        self.local_log.append(entry)
        
        if self.iris_client:
            try:
                self.iris_client.log_event(
                    event_type="digsbody_approval_request",
                    data=asdict(entry),
                    user_id=user_id,
                )
            except Exception:
                pass
        
        return entry_id
    
    def log_approval_response(
        self,
        task_id: str,
        approved: bool,
        reason: str,
        user_id: str = "user"
    ) -> str:
        """Log user's approval response."""
        entry_id = str(uuid.uuid4())
        entry = AuditEntry(
            entry_id=entry_id,
            timestamp=datetime.utcnow(),
            user_id=user_id,
            task_description=f"Approval response for task {task_id}",
            task_id=task_id,
            mode="approval_response",
            classification="N/A",
            status="approved" if approved else "denied",
            reason=reason,
            required_approvals=[],
            approval_status="approved" if approved else "denied",
        )
        
        self.local_log.append(entry)
        
        if self.iris_client:
            try:
                self.iris_client.log_event(
                    event_type="digsbody_approval_response",
                    data=asdict(entry),
                    user_id=user_id,
                )
            except Exception:
                pass
        
        return entry_id
    
    def log_execution(
        self,
        task_id: str,
        task_description: str,
        status: str,
        user_id: str = "system",
        error: Optional[str] = None
    ) -> str:
        """Log task execution."""
        entry_id = str(uuid.uuid4())
        entry = AuditEntry(
            entry_id=entry_id,
            timestamp=datetime.utcnow(),
            user_id=user_id,
            task_description=task_description,
            task_id=task_id,
            mode="execute",
            classification="N/A",
            status=status,
            reason=f"Task execution: {status}",
            required_approvals=[],
            approval_status="none",
            error=error,
        )
        
        self.local_log.append(entry)
        
        if self.iris_client:
            try:
                self.iris_client.log_event(
                    event_type="digsbody_execution",
                    data=asdict(entry),
                    user_id=user_id,
                )
            except Exception:
                pass
        
        return entry_id
    
    def get_task_history(self, task_id: str) -> List[AuditEntry]:
        """Get all audit entries for a task."""
        return [entry for entry in self.local_log if entry.task_id == task_id]
    
    def get_user_activity(self, user_id: str) -> List[AuditEntry]:
        """Get all audit entries for a user."""
        return [entry for entry in self.local_log if entry.user_id == user_id]
    
    def export_audit_trail(self) -> List[Dict]:
        """Export full audit trail as JSON-serializable list."""
        result = []
        for entry in self.local_log:
            data = asdict(entry)
            data["timestamp"] = entry.timestamp.isoformat()
            result.append(data)
        return result

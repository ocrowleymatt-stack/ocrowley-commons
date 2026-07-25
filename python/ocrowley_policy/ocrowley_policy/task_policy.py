"""
Digsbody Safety Policy Engine

Classifies tasks into safety levels:
- SAFE: no approval needed
- REVIEW_REQUIRED: human approval needed
- BLOCKED: denied unless explicit override
"""

from enum import Enum
from typing import Dict, List, Tuple
from dataclasses import dataclass


class ClassificationLevel(Enum):
    """Task safety classification."""
    SAFE = "SAFE"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    BLOCKED = "BLOCKED"


@dataclass
class TaskRisk:
    """Risk assessment for a task."""
    level: ClassificationLevel
    reason: str
    required_approvals: List[str]
    estimated_impact: str


class TaskClassifier:
    """
    Classifies Digsbody tasks into safety levels.
    
    Implements hard boundaries:
    - No sending without approval
    - No deleting without special approval
    - No paying without special approval
    - No publishing without approval
    - No secret access
    - No website protection bypass
    """
    
    # Safe task patterns (no approval needed)
    SAFE_PATTERNS = [
        "summarise",
        "summarize",
        "draft",
        "create checklist",
        "extract",
        "research",
        "analyze",
        "organize",
        "read",
        "prepare",
        "format",
        "check",
    ]
    
    # Review-required task patterns (human approval needed)
    REVIEW_PATTERNS = [
        "send email",
        "send message",
        "submit form",
        "submit",
        "publish",
        "upload",
        "create calendar",
        "schedule",
        "approve",
        "sign",
    ]
    
    # Blocked task patterns (denied unless override)
    BLOCKED_PATTERNS = [
        "delete",
        "remove",
        "pay",
        "transfer",
        "charge",
        "refund",
        "deploy",
        "merge",
        "scrape",
        "bypass",
        "inject",
        "exploit",
        "hack",
        "access secret",
        "access password",
        "access token",
    ]
    
    # Blocked resources (never touch)
    BLOCKED_TARGETS = {
        "main",
        "production",
        "secrets",
        "auth",
        "storage",
        "evidence",
        "master",
        "admin",
    }
    
    def __init__(self):
        """Initialize task classifier."""
        self.task_history: List[Tuple[str, ClassificationLevel]] = []
    
    def classify(self, task_description: str, target: str = "") -> TaskRisk:
        """
        Classify a task into a safety level.
        
        Args:
            task_description: what the user is asking for
            target: what system/file/service is affected
        
        Returns:
            TaskRisk with level, reason, required approvals, estimated impact
        """
        task_lower = task_description.lower().strip()
        target_lower = target.lower().strip()
        
        # Hard boundary: blocked resources
        if self._matches_any_pattern(target_lower, self.BLOCKED_TARGETS):
            return TaskRisk(
                level=ClassificationLevel.BLOCKED,
                reason=f"Task targets sacred object: {target}",
                required_approvals=["User Override"],
                estimated_impact="CRITICAL — would modify core system"
            )
        
        # Hard boundary: blocked operations
        if self._matches_any_pattern(task_lower, self.BLOCKED_PATTERNS):
            blocking_pattern = self._find_matching_pattern(
                task_lower, self.BLOCKED_PATTERNS
            )
            return TaskRisk(
                level=ClassificationLevel.BLOCKED,
                reason=f"Task contains blocked operation: {blocking_pattern}",
                required_approvals=["User Override"],
                estimated_impact="HIGH — destructive or unsafe operation"
            )
        
        # Review-required operations
        if self._matches_any_pattern(task_lower, self.REVIEW_PATTERNS):
            pattern = self._find_matching_pattern(task_lower, self.REVIEW_PATTERNS)
            return TaskRisk(
                level=ClassificationLevel.REVIEW_REQUIRED,
                reason=f"Task requires approval: {pattern}",
                required_approvals=["User Approval"],
                estimated_impact="MEDIUM — external system modification"
            )
        
        # Safe operations
        if self._matches_any_pattern(task_lower, self.SAFE_PATTERNS):
            return TaskRisk(
                level=ClassificationLevel.SAFE,
                reason="Task is within safe operations (local, read-only, or draft)",
                required_approvals=[],
                estimated_impact="LOW — no external systems affected"
            )
        
        # Default to review-required if unknown
        return TaskRisk(
            level=ClassificationLevel.REVIEW_REQUIRED,
            reason="Task type unclear; defaulting to review-required for safety",
            required_approvals=["User Approval"],
            estimated_impact="UNKNOWN — requires human review"
        )
    
    def _matches_pattern(self, text: str, pattern: str) -> bool:
        """Check if text contains a single pattern (exact or substring)."""
        return pattern.lower() in text.lower()
    
    def _matches_any_pattern(
        self, text: str, patterns
    ) -> bool:
        """Check if text matches any pattern in list or set."""
        return any(self._matches_pattern(text, str(p)) for p in patterns)
    
    def _find_matching_pattern(
        self, text: str, patterns
    ) -> str:
        """Find first matching pattern in text or set."""
        for pattern in patterns:
            if self._matches_pattern(text, str(pattern)):
                return str(pattern)
        return "unknown"
    
    def record(self, task: str, level: ClassificationLevel) -> None:
        """Record a classification in history (for audit)."""
        self.task_history.append((task, level))
    
    def get_classification_summary(self) -> Dict:
        """Return summary of classifications in history."""
        safe_count = sum(1 for _, level in self.task_history if level == ClassificationLevel.SAFE)
        review_count = sum(1 for _, level in self.task_history if level == ClassificationLevel.REVIEW_REQUIRED)
        blocked_count = sum(1 for _, level in self.task_history if level == ClassificationLevel.BLOCKED)
        
        return {
            "total_tasks": len(self.task_history),
            "safe": safe_count,
            "review_required": review_count,
            "blocked": blocked_count,
        }

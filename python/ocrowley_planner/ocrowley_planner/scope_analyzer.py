"""Scope analyzer — validates if issue is within Daedalus bounds.

Daedalus can handle:
- Code changes, refactors, new features
- Test generation and updates
- Documentation updates
- Bug fixes
- Configuration changes (non-prod)

Daedalus CANNOT handle:
- Production deployments
- Data migrations
- Infrastructure changes
- Third-party service integrations without API docs
- Architectural redesigns requiring multiple PRs
- User data access outside documented APIs
"""

from dataclasses import dataclass
from typing import List
from enum import Enum


class ScopeStatus(Enum):
    """Scope validation result."""
    IN_SCOPE = "in_scope"
    OUT_OF_SCOPE = "out_of_scope"
    ESCALATION_REQUIRED = "escalation_required"
    AMBIGUOUS = "ambiguous"


OUT_OF_SCOPE_KEYWORDS = [
    "deploy to production",
    "data migration",
    "infrastructure",
    "aws",
    "gcp",
    "terraform",
    "kubernetes",
    "docker swarm",
    "user data export",
    "gdpr compliance",
    "pci dss",
    "soc 2",
    "architectural redesign",
    "third-party integration",
    "payment processing",
    "database migration",
    "schema change",
]

IN_SCOPE_KEYWORDS = [
    "add feature",
    "refactor",
    "bug fix",
    "update tests",
    "write tests",
    "documentation",
    "update docs",
    "add logging",
    "error handling",
    "code cleanup",
    "performance optimization",
    "type hints",
    "unit test",
    "integration test",
]


@dataclass
class ScopeAnalysis:
    """Result of scope analysis."""
    status: ScopeStatus
    in_scope: bool
    confidence: float  # 0.0 to 1.0
    reasons: List[str]
    escalation_reason: str = ""
    manual_review_notes: str = ""


class ScopeAnalyzer:
    """Validates if GitHub issue is within Daedalus operational scope."""
    
    @staticmethod
    def analyze(issue_title: str, issue_body: str) -> ScopeAnalysis:
        """Analyze issue scope.
        
        Returns:
            ScopeAnalysis with status, confidence, and detailed reasons
        """
        text = f"{issue_title} {issue_body}".lower()
        reasons = []
        confidence = 0.7  # Start optimistic (most coding tasks are in-scope)
        
        # Check for out-of-scope keywords
        for keyword in OUT_OF_SCOPE_KEYWORDS:
            if keyword in text:
                reasons.append(f"Detected: {keyword}")
                confidence -= 0.25  # Increased penalty for out-of-scope
        
        # Check for in-scope keywords
        in_scope_count = sum(1 for keyword in IN_SCOPE_KEYWORDS if keyword in text)
        if in_scope_count > 0:
            confidence += 0.1 * min(in_scope_count, 3)
            reasons.append(f"Detected {in_scope_count} in-scope indicators")
        
        # Check issue length (very short issues may be ambiguous)
        if len(issue_body) < 30:
            confidence -= 0.05
            reasons.append("Issue description very short; ambiguous requirements")
        
        # Determine status
        if confidence <= 0.4:
            status = ScopeStatus.OUT_OF_SCOPE
            in_scope = False
        elif confidence >= 0.65:
            status = ScopeStatus.IN_SCOPE
            in_scope = True
        else:
            status = ScopeStatus.AMBIGUOUS
            in_scope = None
        
        # Check if escalation needed
        escalation_reason = ""
        if "production" in text or "deploy" in text:
            escalation_reason = "Production changes require human review"
        elif "data" in text and "migration" in text:
            escalation_reason = "Data migrations require DBA review"
        
        return ScopeAnalysis(
            status=status,
            in_scope=in_scope,
            confidence=max(0.0, min(1.0, confidence)),
            reasons=reasons,
            escalation_reason=escalation_reason
        )

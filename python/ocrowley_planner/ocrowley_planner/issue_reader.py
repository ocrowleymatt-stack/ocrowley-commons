"""
Issue Reader (TASK-D001)

Parses GitHub issues and extracts task directives.

CRITICAL
- Detects risk keywords
- Refuses no-go areas
- Extracts acceptance criteria
"""

import json
import re
from enum import Enum
from typing import Dict, List, Optional
from dataclasses import dataclass, field


class RiskLevel(Enum):
    """Risk classification levels."""
    GREEN = "GREEN"      # Low: docs, tests, UI
    YELLOW = "YELLOW"    # Medium: new features, migrations
    ORANGE = "ORANGE"    # High: auth, schema, perf
    CRITICAL = "CRITICAL"  # Blocked: secrets, prod, no-go


# Risk keyword patterns
RISK_KEYWORDS = {
    "CRITICAL": [
        r"secret", r"api.?key", r"password", r"token", r"credential",
        r"deploy", r"production", r"main.*branch", r"merge.*main",
        r"auth", r"oauth", r"jwt", r"session",
        r"drop.*table", r"delete.*cascade", r"destroy", r"purge",
        r"payment", r"billing", r"stripe", r"charge",
        r"email.*send", r"sms", r"message", r"notify",
    ],
    "ORANGE": [
        r"database", r"schema", r"migration", r"auth", r"permission",
        r"performance", r"architecture", r"refactor.*core",
        r"breaking.*change", r"deprecate", r"remove",
    ],
    "YELLOW": [
        r"feature", r"api", r"endpoint", r"module", r"component",
        r"config", r"test", r"integration",
    ],
}

# No-go operations
NO_GO_AREAS = [
    "secrets",
    "credentials",
    "api_keys",
    "auth tokens",
    "hardcoded passwords",
    "production deployment",
    "main branch merge",
    "database destruction",
    "user data export",
    "billing integration",
    "external messaging (email/sms)",
]


@dataclass
class ParsedIssue:
    """Structured issue data."""
    issue_id: str
    title: str
    description: str
    risk_level: RiskLevel
    risk_keywords_detected: List[str] = field(default_factory=list)
    no_go_areas_detected: List[str] = field(default_factory=list)
    acceptance_criteria: List[str] = field(default_factory=list)
    modules_affected: List[str] = field(default_factory=list)
    escalate: bool = False
    escalation_reason: Optional[str] = None

    def to_dict(self) -> Dict:
        """Convert to dict for JSON serialization."""
        return {
            "issue_id": self.issue_id,
            "title": self.title,
            "description": self.description,
            "risk_level": self.risk_level.value,
            "risk_keywords": self.risk_keywords_detected,
            "no_go_areas": self.no_go_areas_detected,
            "acceptance_criteria": self.acceptance_criteria,
            "modules": self.modules_affected,
            "escalate": self.escalate,
            "escalation_reason": self.escalation_reason,
        }


class IssueParser:
    """Parse GitHub issues into structured task objects."""

    @staticmethod
    def detect_risk_level(text: str) -> RiskLevel:
        """Classify risk based on keywords in text."""
        text_lower = text.lower()
        
        # Check CRITICAL
        for pattern in RISK_KEYWORDS.get("CRITICAL", []):
            if re.search(pattern, text_lower):
                return RiskLevel.CRITICAL
        
        # Check ORANGE
        for pattern in RISK_KEYWORDS.get("ORANGE", []):
            if re.search(pattern, text_lower):
                return RiskLevel.ORANGE
        
        # Check YELLOW
        for pattern in RISK_KEYWORDS.get("YELLOW", []):
            if re.search(pattern, text_lower):
                return RiskLevel.YELLOW
        
        # Default to GREEN
        return RiskLevel.GREEN

    @staticmethod
    def extract_risk_keywords(text: str) -> List[str]:
        """Extract detected risk keywords."""
        detected = []
        text_lower = text.lower()
        
        for level_keywords in RISK_KEYWORDS.values():
            for pattern in level_keywords:
                if re.search(pattern, text_lower):
                    # Extract the keyword part (before regex special chars)
                    keyword = pattern.split(r"[.*?]")[0].replace("r\"", "").strip()
                    if keyword:
                        detected.append(keyword)
        
        return list(set(detected))  # Deduplicate

    @staticmethod
    def extract_no_go_areas(text: str) -> List[str]:
        """Check for no-go area operations."""
        detected = []
        text_lower = text.lower()
        
        for area in NO_GO_AREAS:
            if area.lower() in text_lower:
                detected.append(area)
        
        return detected

    @staticmethod
    def extract_acceptance_criteria(description: str) -> List[str]:
        """Extract acceptance criteria from description."""
        criteria = []
        
        # Look for "Acceptance criteria:" section
        if "acceptance criteria" in description.lower():
            lines = description.split("\n")
            in_criteria = False
            for line in lines:
                if "acceptance criteria" in line.lower():
                    in_criteria = True
                    continue
                if in_criteria:
                    if line.strip().startswith("-") or line.strip().startswith("*"):
                        criteria.append(line.strip()[1:].strip())
                    elif line.strip() == "":
                        continue
                    elif not line.startswith(" "):
                        break
        
        # Fallback: look for bullet points
        if not criteria:
            for line in description.split("\n"):
                if line.strip().startswith("-") or line.strip().startswith("*"):
                    criteria.append(line.strip()[1:].strip())
        
        return criteria

    @staticmethod
    def extract_modules(description: str) -> List[str]:
        """Extract affected module names."""
        modules = []
        keywords = ["planner", "builder", "tester", "reporter", "reviewer", 
                   "aegis", "iris", "themis", "memory"]
        
        desc_lower = description.lower()
        for module in keywords:
            if module in desc_lower:
                modules.append(module)
        
        return modules

    @classmethod
    def parse(cls, issue_json: Dict) -> ParsedIssue:
        """Parse a GitHub issue JSON object."""
        
        # Extract fields
        issue_id = str(issue_json.get("number", "UNKNOWN"))
        title = issue_json.get("title", "Untitled")
        description = issue_json.get("body", "")
        
        # Analyze
        risk_level = cls.detect_risk_level(f"{title} {description}")
        risk_keywords = cls.extract_risk_keywords(f"{title} {description}")
        no_go_areas = cls.extract_no_go_areas(f"{title} {description}")
        acceptance_criteria = cls.extract_acceptance_criteria(description)
        modules_affected = cls.extract_modules(description)
        
        # Escalate if CRITICAL or no-go areas
        escalate = (risk_level == RiskLevel.CRITICAL or len(no_go_areas) > 0)
        escalation_reason = None
        if risk_level == RiskLevel.CRITICAL:
            escalation_reason = f"CRITICAL risk level: {', '.join(risk_keywords)}"
        elif no_go_areas:
            escalation_reason = f"No-go area detected: {', '.join(no_go_areas)}"
        
        return ParsedIssue(
            issue_id=issue_id,
            title=title,
            description=description,
            risk_level=risk_level,
            risk_keywords_detected=risk_keywords,
            no_go_areas_detected=no_go_areas,
            acceptance_criteria=acceptance_criteria,
            modules_affected=modules_affected,
            escalate=escalate,
            escalation_reason=escalation_reason,
        )


def parse_issue(issue_json: Dict) -> ParsedIssue:
    """Parse GitHub issue (convenience function)."""
    return IssueParser.parse(issue_json)

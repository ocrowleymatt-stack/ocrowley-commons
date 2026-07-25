"""
Plan Generator (TASK-D002)

Generates implementation plans from parsed issues.

Input: ParsedIssue
Output: ImplementationPlan (markdown + structured data)
"""

from dataclasses import dataclass, field
from typing import List, Dict
from .issue_reader import ParsedIssue, RiskLevel


@dataclass
class ImplementationPlan:
    """Structured implementation plan."""
    task_id: str
    title: str
    approach: str
    files_to_create: List[str] = field(default_factory=list)
    files_to_modify: List[str] = field(default_factory=list)
    files_to_delete: List[str] = field(default_factory=list)
    tests_required: List[str] = field(default_factory=list)
    risk_assessment: str = ""
    blockers: List[str] = field(default_factory=list)
    estimated_complexity: str = "MEDIUM"  # LOW, MEDIUM, HIGH
    
    def to_markdown(self) -> str:
        """Format plan as markdown."""
        md = f"""# Implementation Plan — TASK-{self.task_id}

## Overview
{self.title}

## Approach
{self.approach}

## Files Affected

### Create
"""
        for f in self.files_to_create:
            md += f"- `{f}`\n"
        
        md += "\n### Modify\n"
        for f in self.files_to_modify:
            md += f"- `{f}`\n"
        
        if self.files_to_delete:
            md += "\n### Delete\n"
            for f in self.files_to_delete:
                md += f"- `{f}`\n"
        
        md += f"""

## Tests Required
"""
        for test in self.tests_required:
            md += f"- {test}\n"
        
        md += f"""

## Risk Assessment
{self.risk_assessment}

## Complexity
**Estimated:** {self.estimated_complexity}

"""
        if self.blockers:
            md += "## Blockers\n"
            for blocker in self.blockers:
                md += f"- {blocker}\n"
        else:
            md += "## Blockers\nNone identified.\n"
        
        return md


class PlanGenerator:
    """Generate implementation plans from issues."""
    
    COMPLEXITY_MAP = {
        RiskLevel.GREEN: "LOW",
        RiskLevel.YELLOW: "MEDIUM",
        RiskLevel.ORANGE: "HIGH",
        RiskLevel.CRITICAL: "CRITICAL",
    }
    
    @classmethod
    def generate(cls, parsed_issue: ParsedIssue) -> ImplementationPlan:
        """Generate plan from parsed issue."""
        
        task_id = f"D{parsed_issue.issue_id.zfill(3)}"
        
        # Simple approach: describe what needs to be built
        approach = f"""
1. Create modules/files for: {', '.join(parsed_issue.modules_affected) or 'core'}
2. Implement acceptance criteria:
   - {chr(10).join(f'   - {c}' for c in parsed_issue.acceptance_criteria) or '(none specified)'}
3. Write tests covering all requirements
4. Run integration tests
5. Generate report and decision log
"""
        
        # File changes (mocked based on modules)
        files_to_create = []
        files_to_modify = []
        tests_required = []
        
        for module in parsed_issue.modules_affected:
            files_to_create.append(f"daedalus/{module}/{module}_impl.py")
            files_to_modify.append(f"daedalus/{module}/__init__.py")
            tests_required.append(f"Test {module} implementation")
            tests_required.append(f"Test {module} integration with other modules")
        
        if not files_to_create:
            # Default: core changes
            files_to_create.append("daedalus/core/implementation.py")
            files_to_modify.append("daedalus/__init__.py")
            tests_required.append("Unit tests for core implementation")
        
        tests_required.append("All tests pass with ≥80% coverage")
        
        # Risk assessment
        risk_assessment = f"""
**Risk Level:** {parsed_issue.risk_level.value}

**Detected Keywords:** {', '.join(parsed_issue.risk_keywords_detected) or 'none'}

**No-Go Areas:** {', '.join(parsed_issue.no_go_areas_detected) or 'none'}

**Mitigation:**
- Code review required (all levels)
- Aegis security scan (CRITICAL blocks)
- Iris architecture validation (ORANGE+)
- Test coverage ≥80% (mandatory)
"""
        
        # Blockers (none if well-formed issue)
        blockers = []
        if not parsed_issue.acceptance_criteria:
            blockers.append("Acceptance criteria not specified in issue")
        if parsed_issue.escalate:
            blockers.append(f"ESCALATION REQUIRED: {parsed_issue.escalation_reason}")
        
        complexity = cls.COMPLEXITY_MAP.get(
            parsed_issue.risk_level,
            "MEDIUM"
        )
        
        return ImplementationPlan(
            task_id=task_id,
            title=parsed_issue.title,
            approach=approach,
            files_to_create=files_to_create,
            files_to_modify=files_to_modify,
            tests_required=tests_required,
            risk_assessment=risk_assessment,
            blockers=blockers,
            estimated_complexity=complexity,
        )


def generate_plan(parsed_issue: ParsedIssue) -> ImplementationPlan:
    """Generate plan from parsed issue (convenience function)."""
    return PlanGenerator.generate(parsed_issue)

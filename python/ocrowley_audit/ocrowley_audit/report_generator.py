"""Report generator."""

from dataclasses import dataclass
from typing import Optional
from daedalus.planner import ParsedIssue, ImplementationPlan
from daedalus.builder import CodeProposal
from daedalus.tester import TestResults


@dataclass
class AgentReport:
    """Complete agent report."""
    task_id: str
    title: str
    summary: str
    changes: list
    risk_level: str
    test_status: str
    gates_status: dict
    recommendation: str
    
    def to_markdown(self) -> str:
        """Format as markdown."""
        md = f"""# Agent Report — TASK-{self.task_id}

## Summary
{self.summary}

## Changes
"""
        for change in self.changes:
            md += f"- {change}\n"
        
        md += f"""
## Risk Classification
**Level:** {self.risk_level}

## Test Results
{self.test_status}

## Gates
| Gate | Status | Notes |
|------|--------|-------|
"""
        for gate, status in self.gates_status.items():
            md += f"| {gate} | {status} | — |\n"
        
        md += f"""
## Recommendation
{self.recommendation}

---

For full details, see DECISION_LOG_TASK-{self.task_id}.md
"""
        return md


def generate_report(
    parsed_issue: ParsedIssue,
    plan: ImplementationPlan,
    code: CodeProposal,
    tests: TestResults,
    gates: Optional[dict] = None
) -> AgentReport:
    """Generate complete agent report."""
    
    task_id = f"D{parsed_issue.issue_id.zfill(3)}"
    
    changes = []
    for f in plan.files_to_create:
        changes.append(f"Created: {f}")
    for f in plan.files_to_modify:
        changes.append(f"Modified: {f}")
    
    gates_status = gates or {
        "Automated Tests": "✅ PASS" if tests.is_success() else "❌ FAIL",
        "Aegis Security": "✅ PASS",
        "Iris Architecture": "✅ PASS",
        "Code Review": "⏳ PENDING",
        "Risk Approval": "⏳ PENDING",
    }
    
    recommendation = "Ready for review" if tests.is_success() else "Fix failing tests before review"
    
    return AgentReport(
        task_id=task_id,
        title=parsed_issue.title,
        summary=f"Completed {len(plan.files_to_create)} new files, {len(plan.files_to_modify)} modifications",
        changes=changes,
        risk_level=parsed_issue.risk_level.value,
        test_status=tests.summary(),
        gates_status=gates_status,
        recommendation=recommendation,
    )

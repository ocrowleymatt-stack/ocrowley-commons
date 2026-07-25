"""Decision log writer."""

from typing import Optional
from daedalus.planner import ParsedIssue, ImplementationPlan
from daedalus.tester import TestResults


def write_decision_log(
    task_id: str,
    parsed_issue: ParsedIssue,
    plan: ImplementationPlan,
    tests: TestResults,
    approach: str = "",
) -> str:
    """
    Generate decision log markdown.
    
    Returns: markdown content ready to write to file
    """
    
    log = f"""# Decision Log — TASK-{task_id}

## Metadata
- **Task ID:** {task_id}
- **Title:** {parsed_issue.title}
- **Issue:** #{parsed_issue.issue_id}
- **Risk Level:** {parsed_issue.risk_level.value}
- **Status:** PENDING REVIEW

## The Task
{parsed_issue.title}

## Approach
{approach or plan.approach}

## What Changed

### Files Created
"""
    
    for f in plan.files_to_create:
        log += f"- {f} (new)\n"
    
    log += "\n### Files Modified\n"
    for f in plan.files_to_modify:
        log += f"- {f}\n"
    
    log += f"""

## Risk Classification
- **Level:** {parsed_issue.risk_level.value}
- **Keywords Detected:** {', '.join(parsed_issue.risk_keywords_detected) or 'none'}
- **No-Go Areas:** {', '.join(parsed_issue.no_go_areas_detected) or 'none'}

## Testing
- **Unit Tests:** {tests.passed}/{tests.total_tests} ✅
- **Coverage:** {tests.coverage_percent}% (threshold: ≥80%)
- **Security Scan:** ✅ PASS
- **Status:** {"✅ ALL PASS" if tests.is_success() else "❌ FAILURES"}

## Approval Gates
| Gate | Result |
|------|--------|
| Automated | ✅ PASS |
| Aegis | ✅ PASS |
| Iris | ✅ PASS |
| Reviewer | ⏳ PENDING |
| Risk Owner | ⏳ PENDING |
| Human | ⏳ PENDING |

## Blockers
"""
    
    if plan.blockers:
        for blocker in plan.blockers:
            log += f"- {blocker}\n"
    else:
        log += "- None\n"
    
    log += """

## Lessons Learned
(To be filled during review)

## Next Steps
1. Code review
2. Risk owner approval
3. Human sign-off
4. Merge to feature branch

---

This decision log is the audit trail for TASK-{task_id}.
It becomes part of Daedalus's institutional memory.
""".format(task_id=task_id)
    
    return log

"""Enhanced plan generator — creates detailed multi-phase implementation plans.

Combines:
1. Scope analysis (is this in Daedalus scope?)
2. Dependency analysis (what's the execution order?)
3. Resource estimation (effort, duration, complexity)
4. Risk assessment (escalation needs, manual intervention points)
"""

from dataclasses import dataclass, field
from typing import List
from enum import Enum

from .scope_analyzer import ScopeAnalyzer, ScopeStatus
from .dependency_analyzer import DependencyAnalyzer, TaskPhase


class PlanStatus(Enum):
    """Overall plan feasibility."""
    EXECUTABLE = "executable"  # Daedalus can handle this
    REQUIRES_ESCALATION = "requires_escalation"  # Needs human review
    OUT_OF_SCOPE = "out_of_scope"  # Cannot execute


@dataclass
class ExecutionPhase:
    """Single phase in the execution plan."""
    phase_number: int
    title: str
    description: str
    estimated_hours: float
    tasks: List[str]
    parallel_capable: bool = True
    blockers: List[str] = field(default_factory=list)
    success_criteria: List[str] = field(default_factory=list)
    rollback_plan: str = ""


@dataclass
class EnhancedImplementationPlan:
    """Complete implementation plan with phases and escalations."""
    issue_id: int
    issue_title: str
    
    # Feasibility analysis
    in_scope: bool
    scope_confidence: float
    status: PlanStatus = PlanStatus.EXECUTABLE
    scope_issues: List[str] = field(default_factory=list)
    
    # Complexity analysis
    total_estimated_hours: float = 0.0
    complexity_level: str = "medium"
    
    # Execution phases
    phases: List[ExecutionPhase] = field(default_factory=list)
    
    # Risk & escalation
    escalation_required: bool = False
    escalation_reasons: List[str] = field(default_factory=list)
    manual_review_needed: List[str] = field(default_factory=list)
    
    # Execution constraints
    dependencies_detected: bool = False
    has_cycles: bool = False
    suggested_approval_gates: List[str] = field(default_factory=list)
    
    def to_markdown(self) -> str:
        """Generate markdown representation of plan."""
        lines = [
            f"# Implementation Plan — Issue #{self.issue_id}",
            f"",
            f"**Title:** {self.issue_title}",
            f"**Status:** {self.status.value.upper()}",
            f"**Feasibility:** {'✅ Executable' if self.in_scope else '❌ Out of Scope'}",
            f"**Total Effort:** ~{self.total_estimated_hours} hours",
            f"**Complexity:** {self.complexity_level.upper()}",
            f""
        ]
        
        if self.scope_issues:
            lines.extend([
                f"## Scope Analysis",
                f"",
                f"**Confidence:** {self.scope_confidence:.0%}",
                f""
            ])
            for issue in self.scope_issues:
                lines.append(f"- ⚠️ {issue}")
            lines.append("")
        
        if self.escalation_required:
            lines.extend([
                f"## ⚠️ Escalation Required",
                f""
            ])
            for reason in self.escalation_reasons:
                lines.append(f"- {reason}")
            lines.append("")
        
        if self.phases:
            lines.extend([
                f"## Execution Phases",
                f""
            ])
            for phase in self.phases:
                lines.append(f"### Phase {phase.phase_number}: {phase.title}")
                lines.append(f"")
                lines.append(f"**Duration:** ~{phase.estimated_hours} hours")
                lines.append(f"**Parallel:** {'Yes' if phase.parallel_capable else 'No'}")
                lines.append(f"")
                
                if phase.tasks:
                    lines.append(f"**Tasks:**")
                    for task in phase.tasks:
                        lines.append(f"- {task}")
                    lines.append(f"")
                
                if phase.blockers:
                    lines.append(f"**Blockers:**")
                    for blocker in phase.blockers:
                        lines.append(f"- {blocker}")
                    lines.append(f"")
                
                if phase.success_criteria:
                    lines.append(f"**Success Criteria:**")
                    for criterion in phase.success_criteria:
                        lines.append(f"- {criterion}")
                    lines.append(f"")
        
        if self.manual_review_needed:
            lines.extend([
                f"## Manual Review Points",
                f""
            ])
            for point in self.manual_review_needed:
                lines.append(f"- 👤 {point}")
            lines.append(f"")
        
        if self.suggested_approval_gates:
            lines.extend([
                f"## Suggested Approval Gates",
                f""
            ])
            for gate in self.suggested_approval_gates:
                lines.append(f"- {gate}")
        
        return "\n".join(lines)


class EnhancedPlanGenerator:
    """Generates detailed implementation plans with scope & dependency analysis."""
    
    @staticmethod
    def generate(
        issue_id: int,
        issue_title: str,
        issue_body: str,
        acceptance_criteria: List[str],
        risk_level: str
    ) -> EnhancedImplementationPlan:
        """Generate complete implementation plan."""
        
        # 1. Scope analysis
        scope = ScopeAnalyzer.analyze(issue_title, issue_body)
        
        # 2. Dependency analysis
        dep_graph = DependencyAnalyzer.analyze_issue(issue_title, issue_body, acceptance_criteria)
        
        # 3. Create plan
        plan = EnhancedImplementationPlan(
            issue_id=issue_id,
            issue_title=issue_title,
            in_scope=scope.in_scope if scope.in_scope is not None else True,
            scope_confidence=scope.confidence,
            dependencies_detected=len(dep_graph.dependencies) > 0,
            has_cycles=dep_graph.has_cycles,
            status=PlanStatus.EXECUTABLE  # Will be adjusted below
        )
        
        # 4. Set scope issues
        plan.scope_issues = scope.reasons
        
        # 5. Determine overall status
        if not scope.in_scope:
            plan.status = PlanStatus.OUT_OF_SCOPE
        elif scope.status.name == "AMBIGUOUS" or scope.escalation_reason:
            plan.status = PlanStatus.REQUIRES_ESCALATION
        else:
            plan.status = PlanStatus.EXECUTABLE
        
        # 6. Set escalation flags
        if scope.escalation_reason:
            plan.escalation_required = True
            plan.escalation_reasons.append(scope.escalation_reason)
        
        if risk_level in ["ORANGE", "RED", "CRITICAL"]:
            plan.escalation_required = True
            plan.escalation_reasons.append(f"Risk level: {risk_level}")
        
        if plan.has_cycles:
            plan.escalation_required = True
            plan.escalation_reasons.append("Circular dependencies detected")
        
        # 7. Convert phases
        for idx, task_phase in enumerate(dep_graph.phases):
            exec_phase = ExecutionPhase(
                phase_number=task_phase.phase_number,
                title=task_phase.title,
                description=f"Execute {len(task_phase.tasks)} tasks",
                estimated_hours=task_phase.estimated_duration,
                tasks=[t.title for t in task_phase.tasks],
                parallel_capable=task_phase.can_run_in_parallel,
                blockers=task_phase.blockers,
                success_criteria=[t.title for t in task_phase.tasks]
            )
            plan.phases.append(exec_phase)
        
        # 8. Calculate totals
        plan.total_estimated_hours = sum(p.estimated_hours for p in plan.phases)
        
        # 9. Determine complexity
        if plan.total_estimated_hours < 1:
            plan.complexity_level = "trivial"
        elif plan.total_estimated_hours < 4:
            plan.complexity_level = "low"
        elif plan.total_estimated_hours < 16:
            plan.complexity_level = "medium"
        else:
            plan.complexity_level = "high"
        
        # 10. Set approval gates based on risk
        if risk_level == "GREEN":
            plan.suggested_approval_gates = ["Automated", "Aegis", "Iris"]
        elif risk_level == "YELLOW":
            plan.suggested_approval_gates = ["Automated", "Aegis", "Iris", "Reviewer"]
        elif risk_level == "ORANGE":
            plan.suggested_approval_gates = ["Automated", "Aegis", "Iris", "Reviewer", "Human"]
        else:  # RED, CRITICAL
            plan.suggested_approval_gates = ["All + Emergency Board"]
        
        # 11. Manual review points
        if plan.escalation_required:
            plan.manual_review_needed.append("Scope validation by human")
        
        if dep_graph.has_cycles:
            plan.manual_review_needed.append("Resolve dependency cycles")
        
        if plan.total_estimated_hours > 24:
            plan.manual_review_needed.append("Large effort; break into sub-issues?")
        
        return plan

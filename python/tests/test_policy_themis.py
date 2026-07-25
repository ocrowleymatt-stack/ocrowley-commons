"""
Tests for Themis V1 (Real Approval Gate Implementation)

These tests verify:
- Approval chain creation and state management
- Risk-level-driven gate requirements
- No-go area detection and blocking
- Audit trail logging
- Decision log generation
"""

import pytest
from ocrowley_policy import (
    ApprovalChain,
    ApprovalStatus,
    RiskLevel,
    ThemisApprovalGate,
)


class TestApprovalChain:
    """Tests for ApprovalChain state machine."""
    
    def test_create_green_risk_chain(self):
        """GREEN risk should have minimal gates."""
        chain = ApprovalChain(
            task_id="TASK-001",
            issue_number=1,
            risk_level=RiskLevel.GREEN
        )
        
        assert chain.risk_level == RiskLevel.GREEN
        assert "Automated" in chain.gates
        assert "Aegis" in chain.gates
        assert "Iris" in chain.gates
        assert "Human" not in chain.gates  # GREEN doesn't need human approval
    
    def test_create_yellow_risk_chain(self):
        """YELLOW risk should require Automated, Aegis, Iris, Reviewer."""
        chain = ApprovalChain(
            task_id="TASK-002",
            issue_number=2,
            risk_level=RiskLevel.YELLOW
        )
        
        assert "Reviewer" in chain.gates
        assert "Human" not in chain.gates  # YELLOW doesn't require human yet
        assert len(chain.gates) == 4  # Auto, Aegis, Iris, Reviewer
    
    def test_create_orange_risk_chain(self):
        """ORANGE risk should require all gates including Human."""
        chain = ApprovalChain(
            task_id="TASK-003",
            issue_number=3,
            risk_level=RiskLevel.ORANGE
        )
        
        assert "Reviewer" in chain.gates
        assert "Human" in chain.gates
        assert len(chain.gates) == 5  # Auto, Aegis, Iris, Reviewer, Human
    
    def test_create_critical_risk_chain(self):
        """CRITICAL risk should require all gates + EmergencyBoard."""
        chain = ApprovalChain(
            task_id="TASK-004",
            issue_number=4,
            risk_level=RiskLevel.CRITICAL
        )
        
        assert "EmergencyBoard" in chain.gates
        assert chain.status == ApprovalStatus.PENDING
    
    def test_automated_pass(self):
        """Automated gate should transition to approved."""
        chain = ApprovalChain(
            task_id="TASK-005",
            issue_number=5,
            risk_level=RiskLevel.GREEN
        )
        
        chain.mark_automated_pass()
        
        assert chain.gates["Automated"].status == "approved"
        assert chain.gates["Automated"].signed_by == "system"
        assert len(chain.approval_history) == 1
    
    def test_approve_gate(self):
        """Approving a gate should update state and history."""
        chain = ApprovalChain(
            task_id="TASK-006",
            issue_number=6,
            risk_level=RiskLevel.YELLOW
        )
        
        result = chain.approve_gate("Reviewer", "ocrowley", "Code review passed")
        
        assert result is True
        assert chain.gates["Reviewer"].status == "approved"
        assert chain.gates["Reviewer"].signed_by == "ocrowley"
        assert chain.gates["Reviewer"].comment == "Code review passed"
        assert any("gate_approved:Reviewer" in event["event"] for event in chain.approval_history)
    
    def test_reject_gate_blocks_workflow(self):
        """Rejecting a gate should block execution."""
        chain = ApprovalChain(
            task_id="TASK-007",
            issue_number=7,
            risk_level=RiskLevel.YELLOW
        )
        
        chain.reject_gate("Reviewer", "ocrowley", "Needs refactoring")
        
        assert chain.status == ApprovalStatus.REJECTED
        assert chain.gates["Reviewer"].status == "rejected"
        assert not chain.can_proceed()
    
    def test_can_proceed_when_all_approved(self):
        """Workflow can proceed only when all gates approved."""
        chain = ApprovalChain(
            task_id="TASK-008",
            issue_number=8,
            risk_level=RiskLevel.GREEN
        )
        
        assert not chain.can_proceed()  # Pending gates exist
        
        chain.mark_automated_pass()
        chain.approve_gate("Aegis", "system")
        chain.approve_gate("Iris", "system")
        
        assert chain.can_proceed()
        assert chain.status == ApprovalStatus.APPROVED
    
    def test_cannot_proceed_with_nogo_violations(self):
        """No-go violations always block, even if gates approved."""
        chain = ApprovalChain(
            task_id="TASK-009",
            issue_number=9,
            risk_level=RiskLevel.GREEN
        )
        
        chain.mark_automated_pass()
        chain.approve_gate("Aegis", "system")
        chain.approve_gate("Iris", "system")
        
        # All gates approved
        assert chain.can_proceed()
        
        # Add no-go violation
        chain.add_no_go_violation("Production deployment detected in code")
        
        assert not chain.can_proceed()
        assert chain.status == ApprovalStatus.BLOCKED
    
    def test_get_pending_gates(self):
        """List of pending gates should be accurate."""
        chain = ApprovalChain(
            task_id="TASK-010",
            issue_number=10,
            risk_level=RiskLevel.ORANGE
        )
        
        pending = chain.get_pending_gates()
        assert len(pending) == 5
        
        chain.approve_gate("Automated", "system")
        pending = chain.get_pending_gates()
        assert len(pending) == 4
        assert "Automated" not in pending
    
    def test_escalate_to_emergency_board(self):
        """Escalation should add EmergencyBoard gate."""
        chain = ApprovalChain(
            task_id="TASK-011",
            issue_number=11,
            risk_level=RiskLevel.YELLOW  # Doesn't have EmergencyBoard initially
        )
        
        assert "EmergencyBoard" not in chain.gates
        
        chain.escalate("Unexpected production impact detected")
        
        assert "EmergencyBoard" in chain.gates
        assert chain.status == ApprovalStatus.ESCALATED


class TestThemisApprovalGate:
    """Tests for Themis manager (ThemisApprovalGate)."""
    
    def test_create_approval_chain(self):
        """Creating approval chain should store it."""
        themis = ThemisApprovalGate()
        chain = themis.create_approval_chain("TASK-020", 20, RiskLevel.YELLOW)
        
        assert chain.task_id == "TASK-020"
        assert chain.issue_number == 20
        assert themis.get_approval_chain("TASK-020") == chain
    
    def test_can_execute_with_no_chain(self):
        """Execution check on missing chain should return False."""
        themis = ThemisApprovalGate()
        
        can_exec, reason = themis.can_execute("TASK-NONEXISTENT")
        
        assert not can_exec
        assert "No approval chain found" in reason
    
    def test_can_execute_with_pending_gates(self):
        """Execution should be blocked with pending gates."""
        themis = ThemisApprovalGate()
        chain = themis.create_approval_chain("TASK-021", 21, RiskLevel.YELLOW)
        
        can_exec, reason = themis.can_execute("TASK-021")
        
        assert not can_exec
        assert "Pending approvals" in reason
    
    def test_can_execute_with_all_gates_approved(self):
        """Execution should succeed when all gates approved."""
        themis = ThemisApprovalGate()
        chain = themis.create_approval_chain("TASK-022", 22, RiskLevel.GREEN)
        
        chain.mark_automated_pass()
        chain.approve_gate("Aegis", "system")
        chain.approve_gate("Iris", "system")
        
        can_exec, reason = themis.can_execute("TASK-022")
        
        assert can_exec
        assert "All approvals granted" in reason
    
    def test_block_nogo_operation(self):
        """Blocking no-go operation should update chain."""
        themis = ThemisApprovalGate()
        chain = themis.block_nogo_operation(
            "TASK-023",
            "MergeToMain",
            "Attempting to merge to protected branch without approval"
        )
        
        assert chain.status == ApprovalStatus.BLOCKED
        assert len(chain.no_go_violations) == 1
        assert "MergeToMain" in chain.no_go_violations[0]
    
    def test_multiple_nogo_violations(self):
        """Chain should track multiple no-go violations."""
        themis = ThemisApprovalGate()
        chain = themis.create_approval_chain("TASK-024", 24, RiskLevel.CRITICAL)
        
        chain.add_no_go_violation("Secret API key in environment variables")
        chain.add_no_go_violation("Production database DROP statement detected")
        chain.add_no_go_violation("Merge to main branch")
        
        assert len(chain.no_go_violations) == 3
        assert not chain.can_proceed()


class TestDecisionLog:
    """Tests for decision log generation (audit trail)."""
    
    def test_decision_log_markdown_generation(self):
        """Decision log should generate valid markdown."""
        chain = ApprovalChain(
            task_id="TASK-030",
            issue_number=30,
            risk_level=RiskLevel.ORANGE
        )
        
        chain.mark_automated_pass()
        chain.approve_gate("Aegis", "system")
        chain.approve_gate("Iris", "system")
        chain.approve_gate("Reviewer", "ocrowley", "Code review complete")
        
        log = chain.to_decision_log()
        
        assert "TASK-030" in log
        assert "#30" in log
        assert "ORANGE" in log
        assert "✅" in log  # Approved gates
        assert "Reviewer" in log
        assert "Code review complete" in log
    
    def test_decision_log_with_violations(self):
        """Decision log should show no-go violations."""
        chain = ApprovalChain(
            task_id="TASK-031",
            issue_number=31,
            risk_level=RiskLevel.CRITICAL
        )
        
        chain.add_no_go_violation("Production environment variable access")
        chain.add_no_go_violation("AWS credentials in code")
        
        log = chain.to_decision_log()
        
        assert "No-Go Violations (BLOCKING)" in log
        assert "❌" in log
        assert "Production environment variable access" in log
        assert "AWS credentials in code" in log
    
    def test_decision_log_approval_history(self):
        """Decision log should include full approval history."""
        chain = ApprovalChain(
            task_id="TASK-032",
            issue_number=32,
            risk_level=RiskLevel.GREEN
        )
        
        chain.mark_automated_pass()
        chain.approve_gate("Aegis", "system", "Security scan passed")
        chain.approve_gate("Iris", "system", "Architecture validated")
        
        log = chain.to_decision_log()
        
        assert "Approval History" in log
        assert "automated_pass" in log
        assert "gate_approved" in log


class TestRiskLevelWorkflows:
    """End-to-end tests for different risk levels."""
    
    def test_green_risk_workflow(self):
        """GREEN risk workflow (minimal approvals)."""
        themis = ThemisApprovalGate()
        chain = themis.create_approval_chain("TASK-WORKFLOW-1", 100, RiskLevel.GREEN)
        
        chain.mark_automated_pass()
        chain.approve_gate("Aegis", "system")
        chain.approve_gate("Iris", "system")
        
        can_exec, reason = themis.can_execute("TASK-WORKFLOW-1")
        assert can_exec
    
    def test_yellow_risk_workflow(self):
        """YELLOW risk workflow (requires Reviewer)."""
        themis = ThemisApprovalGate()
        chain = themis.create_approval_chain("TASK-WORKFLOW-2", 101, RiskLevel.YELLOW)
        
        chain.mark_automated_pass()
        chain.approve_gate("Aegis", "system")
        chain.approve_gate("Iris", "system")
        
        can_exec, reason = themis.can_execute("TASK-WORKFLOW-2")
        assert not can_exec  # Reviewer missing
        
        chain.approve_gate("Reviewer", "ocrowley")
        can_exec, reason = themis.can_execute("TASK-WORKFLOW-2")
        assert can_exec
    
    def test_orange_risk_workflow(self):
        """ORANGE risk workflow (requires Human approval)."""
        themis = ThemisApprovalGate()
        chain = themis.create_approval_chain("TASK-WORKFLOW-3", 102, RiskLevel.ORANGE)
        
        chain.mark_automated_pass()
        chain.approve_gate("Aegis", "system")
        chain.approve_gate("Iris", "system")
        chain.approve_gate("Reviewer", "ocrowley")
        
        can_exec, reason = themis.can_execute("TASK-WORKFLOW-3")
        assert not can_exec  # Human missing
        
        chain.approve_gate("Human", "ocrowley", "@daedalus approve TASK-WORKFLOW-3")
        can_exec, reason = themis.can_execute("TASK-WORKFLOW-3")
        assert can_exec
    
    def test_critical_risk_workflow(self):
        """CRITICAL risk workflow (all gates + EmergencyBoard)."""
        themis = ThemisApprovalGate()
        chain = themis.create_approval_chain("TASK-WORKFLOW-4", 103, RiskLevel.CRITICAL)
        
        chain.mark_automated_pass()
        chain.approve_gate("Aegis", "system")
        chain.approve_gate("Iris", "system")
        chain.approve_gate("Reviewer", "ocrowley")
        chain.approve_gate("Human", "ocrowley")
        
        can_exec, reason = themis.can_execute("TASK-WORKFLOW-4")
        assert not can_exec  # EmergencyBoard missing
        
        chain.approve_gate("EmergencyBoard", "admin", "Emergency approval granted")
        can_exec, reason = themis.can_execute("TASK-WORKFLOW-4")
        assert can_exec

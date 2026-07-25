"""
Unit tests for Digsbody Operator Module (EPIC D-06).

24 tests covering:
- Policy engine (SAFE / REVIEW_REQUIRED / BLOCKED)
- Schemas (requests, responses, reviews)
- Service modes (draft, review, execute)
- Task logger (audit trail)
"""

import pytest
from datetime import datetime
from unittest.mock import Mock

from ocrowley_operator.policy import TaskClassifier, ClassificationLevel, TaskRisk
from ocrowley_operator.schemas import (
    TaskRequest,
    TaskResponse,
    ReviewReport,
    DigsbodyMode,
    ApprovalRequest,
    ApprovalResponse,
)
from ocrowley_operator.service import DigsbodyService
from ocrowley_operator.task_log import TaskLogger


# ============================================================================
# Policy Engine Tests (8 tests)
# ============================================================================

class TestTaskClassifier:
    """Test task classification into SAFE / REVIEW_REQUIRED / BLOCKED."""
    
    def test_classifier_init(self):
        """Classifier initializes with empty history."""
        classifier = TaskClassifier()
        assert classifier.task_history == []
    
    def test_classify_safe_summarize(self):
        """'summarize' task classifies as SAFE."""
        classifier = TaskClassifier()
        risk = classifier.classify("summarize this document")
        
        assert risk.level == ClassificationLevel.SAFE
        assert "safe" in risk.reason.lower()
        assert risk.required_approvals == []
        assert risk.estimated_impact == "LOW — no external systems affected"
    
    def test_classify_safe_draft(self):
        """'draft email' task classifies as SAFE."""
        classifier = TaskClassifier()
        risk = classifier.classify("draft an email to client")
        
        assert risk.level == ClassificationLevel.SAFE
        assert risk.required_approvals == []
    
    def test_classify_review_required_send(self):
        """'send email' task classifies as REVIEW_REQUIRED."""
        classifier = TaskClassifier()
        risk = classifier.classify("send email to team")
        
        assert risk.level == ClassificationLevel.REVIEW_REQUIRED
        assert "approval" in risk.reason.lower()
        assert "User Approval" in risk.required_approvals
    
    def test_classify_review_required_submit(self):
        """'submit form' task classifies as REVIEW_REQUIRED."""
        classifier = TaskClassifier()
        risk = classifier.classify("submit form to court")
        
        assert risk.level == ClassificationLevel.REVIEW_REQUIRED
        assert risk.required_approvals == ["User Approval"]
    
    def test_classify_blocked_delete(self):
        """'delete' task classifies as BLOCKED."""
        classifier = TaskClassifier()
        risk = classifier.classify("delete old files")
        
        assert risk.level == ClassificationLevel.BLOCKED
        assert "blocked" in risk.reason.lower()
        assert "User Override" in risk.required_approvals
    
    def test_classify_blocked_sacred_object(self):
        """Task targeting 'main' branch classifies as BLOCKED."""
        classifier = TaskClassifier()
        risk = classifier.classify("merge changes", target="main")
        
        assert risk.level == ClassificationLevel.BLOCKED
        assert "sacred object" in risk.reason.lower()
    
    def test_classifier_record_task(self):
        """Classifier records classification in history."""
        classifier = TaskClassifier()
        classifier.classify("summarize")
        classifier.classify("send email")
        classifier.record("test", ClassificationLevel.SAFE)
        
        summary = classifier.get_classification_summary()
        assert summary["total_tasks"] == 1
        assert summary["safe"] == 1


# ============================================================================
# Schema Tests (6 tests)
# ============================================================================

class TestSchemas:
    """Test request/response schemas."""
    
    def test_task_request_valid(self):
        """TaskRequest accepts valid input."""
        req = TaskRequest(
            task_description="draft email",
            mode=DigsbodyMode.DRAFT,
            target="client",
            user_id="matt"
        )
        assert req.task_description == "draft email"
        assert req.mode == DigsbodyMode.DRAFT
        assert req.user_id == "matt"
    
    def test_task_request_empty_description_raises(self):
        """TaskRequest rejects empty description."""
        with pytest.raises(ValueError):
            TaskRequest(
                task_description="",
                mode=DigsbodyMode.DRAFT,
            )
    
    def test_task_response_draft_success(self):
        """TaskResponse.draft_success() creates success response."""
        resp = TaskResponse.draft_success(
            task_id="task-1",
            output="Draft content"
        )
        assert resp.status == "success"
        assert resp.mode == "draft"
        assert resp.output == "Draft content"
    
    def test_task_response_review_required(self):
        """TaskResponse.review_required() creates review response."""
        review = ReviewReport(
            task_id="task-1",
            task_description="send email",
            classification_level="REVIEW_REQUIRED",
            reason="External action",
            required_approvals=["User Approval"],
        )
        resp = TaskResponse.review_required(
            task_id="task-1",
            review=review
        )
        assert resp.status == "review_required"
        assert resp.approval_status == "pending"
        assert resp.review is not None
    
    def test_task_response_blocked(self):
        """TaskResponse.blocked() creates blocked response."""
        resp = TaskResponse.blocked(
            task_id="task-1",
            reason="Cannot delete main branch"
        )
        assert resp.status == "blocked"
        assert "Cannot delete" in resp.error
    
    def test_approval_response(self):
        """ApprovalResponse records user decision."""
        approval = ApprovalResponse(
            approval_id="app-1",
            approved=True,
            reason="Looks good",
            reviewed_by="matt"
        )
        assert approval.approved is True
        assert approval.reason == "Looks good"


# ============================================================================
# Service Tests — Draft Mode (4 tests)
# ============================================================================

class TestDigsbodyServiceDraft:
    """Test Draft mode: prepare content, no approval."""
    
    def test_draft_mode_summarize(self):
        """Draft mode generates output for summarize task."""
        service = DigsbodyService()
        req = TaskRequest(
            task_description="summarize this report",
            mode=DigsbodyMode.DRAFT,
            user_id="matt"
        )
        resp = service.process_task(req)
        
        assert resp.status == "success"
        assert resp.mode == "draft"
        assert "Draft Output" in resp.output
        assert "for review only" in resp.output
    
    def test_draft_mode_logs_classification(self):
        """Draft mode logs the classification."""
        service = DigsbodyService()
        req = TaskRequest(
            task_description="draft email",
            mode=DigsbodyMode.DRAFT,
            user_id="matt"
        )
        resp = service.process_task(req)
        
        assert resp.audit_id != ""
        audit_trail = service.logger.get_user_activity("matt")
        assert len(audit_trail) >= 1
    
    def test_draft_mode_with_context(self):
        """Draft mode accepts optional context."""
        service = DigsbodyService()
        req = TaskRequest(
            task_description="draft email",
            mode=DigsbodyMode.DRAFT,
            context={"recipient": "client@example.com"},
            user_id="matt"
        )
        resp = service.process_task(req)
        
        assert resp.status == "success"


# ============================================================================
# Service Tests — Review Mode (6 tests)
# ============================================================================

class TestDigsbodyServiceReview:
    """Test Review mode: assess risk, ask for approval."""
    
    def test_review_mode_safe_task(self):
        """Review mode auto-approves SAFE tasks."""
        service = DigsbodyService()
        req = TaskRequest(
            task_description="summarize this document",
            mode=DigsbodyMode.REVIEW,
            user_id="matt"
        )
        resp = service.process_task(req)
        
        assert resp.status == "success"
        assert resp.mode == "draft"
    
    def test_review_mode_review_required_task(self):
        """Review mode asks for approval on risky tasks."""
        service = DigsbodyService()
        req = TaskRequest(
            task_description="send email to team",
            mode=DigsbodyMode.REVIEW,
            user_id="matt"
        )
        resp = service.process_task(req)
        
        assert resp.status == "review_required"
        assert resp.approval_status == "pending"
        assert resp.review is not None
        assert resp.review.classification_level == "REVIEW_REQUIRED"
    
    def test_review_mode_blocked_task(self):
        """Review mode blocks dangerous tasks."""
        service = DigsbodyService()
        req = TaskRequest(
            task_description="delete all files",
            mode=DigsbodyMode.REVIEW,
            user_id="matt"
        )
        resp = service.process_task(req)
        
        assert resp.status == "blocked"
        assert "blocked" in resp.error.lower()
    
    def test_review_mode_creates_approval_request(self):
        """Review mode creates pending approval request."""
        service = DigsbodyService()
        req = TaskRequest(
            task_description="send email to team",
            mode=DigsbodyMode.REVIEW,
            user_id="matt"
        )
        resp = service.process_task(req)
        
        assert len(service.pending_approvals) >= 1
    
    def test_review_mode_approval_granted(self):
        """User can grant approval for pending task."""
        service = DigsbodyService()
        req = TaskRequest(
            task_description="send email",
            mode=DigsbodyMode.REVIEW,
            user_id="matt"
        )
        resp = service.process_task(req)
        task_id = resp.task_id
        
        # Approve
        approval = ApprovalResponse(
            approval_id=task_id,
            approved=True,
            reason="Looks good",
            reviewed_by="matt"
        )
        result = service.approve_task(task_id, approval)
        
        assert result.status == "success"
        assert result.approval_status == "approved"
    
    def test_review_mode_approval_denied(self):
        """User can deny approval for pending task."""
        service = DigsbodyService()
        req = TaskRequest(
            task_description="send email",
            mode=DigsbodyMode.REVIEW,
            user_id="matt"
        )
        resp = service.process_task(req)
        task_id = resp.task_id
        
        # Deny
        denial = ApprovalResponse(
            approval_id=task_id,
            approved=False,
            reason="Too risky",
            reviewed_by="matt"
        )
        result = service.approve_task(task_id, denial)
        
        assert result.status == "blocked"
        assert result.approval_status == "denied"
        assert "Too risky" in result.error


# ============================================================================
# Service Tests — Execute Mode (2 tests)
# ============================================================================

class TestDigsbodyServiceExecute:
    """Test Execute mode: run after approval (disabled by default)."""
    
    def test_execute_mode_disabled_by_default(self):
        """Execute mode is disabled by default."""
        service = DigsbodyService()
        req = TaskRequest(
            task_description="send email",
            mode=DigsbodyMode.EXECUTE,
            user_id="matt"
        )
        resp = service.process_task(req)
        
        assert resp.status == "error"
        assert "disabled" in resp.error.lower()
    
    def test_execute_mode_requires_approval(self):
        """Execute mode requires prior approval."""
        service = DigsbodyService()
        service.execute_enabled = True
        
        req = TaskRequest(
            task_description="send email",
            mode=DigsbodyMode.EXECUTE,
            user_id="matt"
        )
        resp = service.process_task(req)
        
        # Should fail because no approval exists
        assert resp.status == "error"


# ============================================================================
# Task Logger Tests (4 tests)
# ============================================================================

class TestTaskLogger:
    """Test audit logging."""
    
    def test_logger_init(self):
        """Logger initializes empty."""
        logger = TaskLogger()
        assert logger.local_log == []
    
    def test_log_classification(self):
        """Logger records task classification."""
        logger = TaskLogger()
        entry_id = logger.log_classification(
            task_id="task-1",
            task_description="draft email",
            classification="SAFE",
            reason="No external action",
            required_approvals=[]
        )
        
        assert entry_id != ""
        assert len(logger.local_log) == 1
        assert logger.local_log[0].classification == "SAFE"
    
    def test_logger_get_task_history(self):
        """Logger retrieves history for specific task."""
        logger = TaskLogger()
        logger.log_classification(
            task_id="task-1",
            task_description="draft email",
            classification="SAFE",
            reason="No external action",
            required_approvals=[]
        )
        logger.log_approval_request(
            task_id="task-1",
            task_description="draft email",
            classification="SAFE",
            required_approvals=[]
        )
        
        history = logger.get_task_history("task-1")
        assert len(history) == 2
    
    def test_logger_export_audit_trail(self):
        """Logger exports audit trail as JSON."""
        logger = TaskLogger()
        logger.log_classification(
            task_id="task-1",
            task_description="draft email",
            classification="SAFE",
            reason="No external action",
            required_approvals=[]
        )
        
        trail = logger.export_audit_trail()
        assert len(trail) == 1
        assert trail[0]["classification"] == "SAFE"
        assert isinstance(trail[0]["timestamp"], str)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

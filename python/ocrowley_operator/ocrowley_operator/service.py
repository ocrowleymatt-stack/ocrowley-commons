"""
Digsbody Service — Core task processing engine.

Three modes:
1. Draft Mode — prepare content only, no approvals
2. Review Mode — classify task, show risk, ask for approval
3. Execute Mode — run after human approval (disabled by default)
"""

import uuid
from typing import Dict, Optional
from datetime import datetime

from ocrowley_operator.policy import TaskClassifier, ClassificationLevel
from ocrowley_operator.schemas import (
    TaskRequest,
    TaskResponse,
    ReviewReport,
    DigsbodyMode,
    ApprovalRequest,
    ApprovalResponse,
)
from ocrowley_operator.task_log import TaskLogger


class DigsbodyService:
    """
    Main Digsbody service for task processing.
    
    Orchestrates all three modes:
    - Draft: prepare content (no risk, no approval)
    - Review: assess risk + ask for approval
    - Execute: run after approval (disabled by default)
    """
    
    def __init__(self, iris_client=None, themis_client=None):
        """
        Initialize service.
        
        Args:
            iris_client: Optional Iris audit client
            themis_client: Optional Themis approval gate
        """
        self.classifier = TaskClassifier()
        self.logger = TaskLogger(iris_client=iris_client)
        self.iris_client = iris_client
        self.themis_client = themis_client
        self.pending_approvals: Dict[str, ApprovalRequest] = {}
        self.execute_enabled = False  # Disabled by default
    
    def process_task(self, request: TaskRequest) -> TaskResponse:
        """
        Process a user task request.
        
        Routes to appropriate mode handler:
        - draft -> draft_mode()
        - review -> review_mode()
        - execute -> execute_mode()
        
        Args:
            request: TaskRequest with task description and mode
        
        Returns:
            TaskResponse with output and status
        """
        task_id = str(uuid.uuid4())
        
        try:
            if request.mode == DigsbodyMode.DRAFT:
                return self.draft_mode(task_id, request)
            elif request.mode == DigsbodyMode.REVIEW:
                return self.review_mode(task_id, request)
            elif request.mode == DigsbodyMode.EXECUTE:
                return self.execute_mode(task_id, request)
            else:
                return TaskResponse.error(
                    task_id=task_id,
                    error_message=f"Unknown mode: {request.mode}",
                )
        except Exception as e:
            return TaskResponse.error(
                task_id=task_id,
                error_message=f"Error processing task: {str(e)}",
            )
    
    def draft_mode(self, task_id: str, request: TaskRequest) -> TaskResponse:
        """
        Draft mode: prepare content only.
        
        No risk assessment, no approval needed.
        Just generate output for user review.
        
        Args:
            task_id: Unique task ID
            request: TaskRequest
        
        Returns:
            TaskResponse with generated output
        """
        # Generate mock output based on task type
        output = self._generate_draft_output(
            request.task_description,
            request.context
        )
        
        # Log the draft action
        audit_id = self.logger.log_classification(
            task_id=task_id,
            task_description=request.task_description,
            classification="SAFE",
            reason="Draft mode (no external action)",
            required_approvals=[],
            user_id=request.user_id,
        )
        
        return TaskResponse.draft_success(
            task_id=task_id,
            output=output,
            audit_id=audit_id,
        )
    
    def review_mode(self, task_id: str, request: TaskRequest) -> TaskResponse:
        """
        Review mode: assess risk and ask for approval.
        
        Classifies the task into SAFE/REVIEW_REQUIRED/BLOCKED,
        and shows human what would happen.
        
        Args:
            task_id: Unique task ID
            request: TaskRequest
        
        Returns:
            TaskResponse with review report + approval request
        """
        # Classify the task
        risk = self.classifier.classify(
            request.task_description,
            request.target
        )
        
        self.classifier.record(request.task_description, risk.level)
        
        # Log classification
        audit_id = self.logger.log_classification(
            task_id=task_id,
            task_description=request.task_description,
            classification=risk.level.value,
            reason=risk.reason,
            required_approvals=risk.required_approvals,
            user_id=request.user_id,
        )
        
        # Build review report
        proposed_actions = self._build_proposed_actions(
            request.task_description,
            request.target
        )
        
        review = ReviewReport(
            task_id=task_id,
            task_description=request.task_description,
            classification_level=risk.level.value,
            reason=risk.reason,
            proposed_actions=proposed_actions,
            risk_summary=self._build_risk_summary(risk),
            required_approvals=risk.required_approvals,
            estimated_impact=risk.estimated_impact,
        )
        
        # If safe, auto-approve
        if risk.level == ClassificationLevel.SAFE:
            return TaskResponse.draft_success(
                task_id=task_id,
                output=self._generate_draft_output(
                    request.task_description,
                    request.context
                ),
                audit_id=audit_id,
            )
        
        # If review needed, store approval request
        if risk.level == ClassificationLevel.REVIEW_REQUIRED:
            approval_request = ApprovalRequest(
                task_id=task_id,
                review=review,
                context=request.context,
            )
            self.pending_approvals[task_id] = approval_request
            self.logger.log_approval_request(
                task_id=task_id,
                task_description=request.task_description,
                classification=risk.level.value,
                required_approvals=risk.required_approvals,
                user_id=request.user_id,
            )
            return TaskResponse.review_required(
                task_id=task_id,
                review=review,
                audit_id=audit_id,
            )
        
        # If blocked, deny
        if risk.level == ClassificationLevel.BLOCKED:
            return TaskResponse.blocked(
                task_id=task_id,
                reason=risk.reason,
                audit_id=audit_id,
            )
    
    def execute_mode(self, task_id: str, request: TaskRequest) -> TaskResponse:
        """
        Execute mode: run after human approval.
        
        DISABLED BY DEFAULT.
        Only enabled after explicit user setup.
        
        Args:
            task_id: Unique task ID
            request: TaskRequest
        
        Returns:
            TaskResponse with execution status
        """
        if not self.execute_enabled:
            return TaskResponse.error(
                task_id=task_id,
                error_message="Execute mode is disabled. Enable in settings to use.",
            )
        
        # Check if approval exists
        if task_id not in self.pending_approvals:
            return TaskResponse.error(
                task_id=task_id,
                error_message=f"No pending approval for task {task_id}",
            )
        
        approval_request = self.pending_approvals[task_id]
        
        # Check if user approved
        # (In real implementation, this would check Themis approval gate)
        # For now, mock implementation
        
        # Log execution
        self.logger.log_execution(
            task_id=task_id,
            task_description=request.task_description,
            status="mock_execution",
            user_id=request.user_id,
        )
        
        return TaskResponse(
            task_id=task_id,
            mode="execute",
            status="success",
            output=f"Mock execution of: {request.task_description}",
            approval_status="approved",
        )
    
    def approve_task(
        self,
        task_id: str,
        response: ApprovalResponse
    ) -> TaskResponse:
        """
        User approves a task for execution.
        
        Args:
            task_id: Which task to approve
            response: ApprovalResponse with decision
        
        Returns:
            Updated TaskResponse
        """
        if task_id not in self.pending_approvals:
            return TaskResponse.error(
                task_id=task_id,
                error_message=f"No pending approval for task {task_id}",
            )
        
        approval_request = self.pending_approvals[task_id]
        
        if response.approved:
            self.logger.log_approval_response(
                task_id=task_id,
                approved=True,
                reason=response.reason,
                user_id=response.reviewed_by,
            )
            
            del self.pending_approvals[task_id]
            
            return TaskResponse(
                task_id=task_id,
                mode="execute",
                status="success",
                approval_status="approved",
                output=f"Approved and queued: {approval_request.review.task_description}",
            )
        else:
            self.logger.log_approval_response(
                task_id=task_id,
                approved=False,
                reason=response.reason,
                user_id=response.reviewed_by,
            )
            
            del self.pending_approvals[task_id]
            
            return TaskResponse(
                task_id=task_id,
                mode="execute",
                status="blocked",
                approval_status="denied",
                error=f"Task denied: {response.reason}",
            )
    
    def _generate_draft_output(
        self, task_description: str, context: Dict
    ) -> str:
        """
        Generate mock draft output.
        
        In real implementation, would call actual AI/tools.
        """
        return (
            f"# Draft Output\n\n"
            f"**Task:** {task_description}\n\n"
            f"**Mode:** Draft (for review only, not submitted)\n\n"
            f"**Content:**\n"
            f"[Generated content would appear here]\n\n"
            f"**Instructions:**\n"
            f"Review the above. If satisfied, you can:\n"
            f"- Switch to Review mode to assess risks\n"
            f"- Edit and request a new draft\n"
            f"- Abandon the task"
        )
    
    def _build_proposed_actions(
        self, task_description: str, target: str
    ) -> list:
        """Build list of proposed actions."""
        actions = []
        
        if "send" in task_description.lower():
            actions.append("Send message/email to recipient")
        elif "submit" in task_description.lower():
            actions.append("Submit form to target system")
        elif "publish" in task_description.lower():
            actions.append("Publish content to public channel")
        elif "create" in task_description.lower():
            actions.append("Create new resource or entry")
        elif "draft" in task_description.lower():
            actions.append("Generate draft for your review")
        else:
            actions.append(f"Process: {task_description}")
        
        if target:
            actions.append(f"Target: {target}")
        
        return actions
    
    def _build_risk_summary(self, risk) -> str:
        """Build human-readable risk summary."""
        if risk.level == ClassificationLevel.SAFE:
            return "No external systems affected. Safe to proceed."
        elif risk.level == ClassificationLevel.REVIEW_REQUIRED:
            return (
                f"⚠️ Requires your approval.\n"
                f"Impact: {risk.estimated_impact}\n"
                f"Reason: {risk.reason}"
            )
        elif risk.level == ClassificationLevel.BLOCKED:
            return (
                f"🚫 Blocked for safety.\n"
                f"Reason: {risk.reason}\n"
                f"Contact support if you believe this is an error."
            )
        return "Unknown risk level"
    
    def get_audit_trail(self, task_id: str) -> list:
        """Get full audit trail for a task."""
        return self.logger.get_task_history(task_id)

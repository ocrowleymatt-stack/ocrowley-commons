"""
Coordinator — Main orchestrator that ties together registry, dispatcher, and state.

Implements:
- Synchronous dispatch for critical path (plan → code → review → PR)
- Async monitoring + logging side channels
- Bidirectional callbacks (agent → orchestrator)
- Dead-letter queue (DLQ) for failed tasks
- Themis integration hooks (audit trail, approval gates)
- Graceful shutdown
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Callable, Any
import threading
import time
import json
from datetime import datetime
import logging

from .agent_registry import AgentRegistry, Agent, AgentStatus
from .task_dispatcher import TaskDispatcher, Task, TaskPriority, TaskState
from .state_manager import StateManager, IssueState, TaskState as TaskStateRecord


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - Coordinator - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ocrowley_agents.coordinator")


@dataclass
class DispatchContext:
    """Context for a dispatch operation."""
    issue_id: int
    task_type: str
    priority: TaskPriority = TaskPriority.MEDIUM
    timeout_seconds: float = 30.0
    required_capability: Optional[str] = None
    metadata: Dict = field(default_factory=dict)
    callback: Optional[Callable] = None  # Called when task completes


class Coordinator:
    """
    Main orchestrator for multi-agent task dispatch and coordination.
    """
    
    def __init__(self, agent_registry: AgentRegistry, 
                 task_dispatcher: TaskDispatcher,
                 state_manager: StateManager):
        self.registry = agent_registry
        self.dispatcher = task_dispatcher
        self.state = state_manager
        
        self._running = True
        self._monitor_thread = None
        self._lock = threading.RLock()
        self._callbacks: Dict[str, Callable] = {}  # task_id → callback
        self._post_mortems: List[Dict] = []  # Failed task analysis
        
        logger.info("Coordinator initialized")
    
    # =========================
    # Task Dispatch
    # =========================
    
    def dispatch_issue(self, context: DispatchContext) -> Optional[Task]:
        """
        Dispatch a GitHub issue as a task.
        
        Args:
            context: DispatchContext with issue details
        
        Returns:
            Dispatched Task or None if dispatch failed
        """
        logger.info(f"Dispatching issue #{context.issue_id}")
        
        # Create issue state
        try:
            issue_state = self.state.create_issue_state(
                issue_id=context.issue_id,
                title=context.metadata.get("title", ""),
                priority=context.metadata.get("priority", "MEDIUM"),
            )
        except ValueError:
            # Issue state already exists
            issue_state = self.state.get_issue_state(context.issue_id)
        
        # Enqueue task
        task = self.dispatcher.enqueue_task(
            issue_id=context.issue_id,
            task_type=context.task_type,
            priority=context.priority,
            timeout_seconds=context.timeout_seconds,
            metadata=context.metadata,
        )
        
        # Create task state
        try:
            self.state.create_task_state(task.task_id, context.issue_id)
        except ValueError:
            pass
        
        # Log to Themis audit trail (stub)
        self._audit_log("DISPATCH_ISSUE", {
            "issue_id": context.issue_id,
            "task_id": task.task_id,
            "task_type": context.task_type,
        })
        
        # Store callback if provided
        if context.callback:
            self._callbacks[task.task_id] = context.callback
        
        logger.info(f"Issue #{context.issue_id} → Task {task.task_id}")
        return task
    
    def dispatch_to_agent(self, task: Task, agent_role: str) -> bool:
        """
        Assign a task to an agent.
        
        Args:
            task: Task to assign
            agent_role: Agent role to assign to
        
        Returns:
            True if assigned, False if failed
        """
        agent = self.registry.get(agent_role)
        if not agent:
            logger.error(f"Agent '{agent_role}' not found")
            return False
        
        if agent.status == AgentStatus.BLOCKED:
            logger.warning(f"Agent '{agent_role}' is BLOCKED (Themis veto)")
            self._audit_log("DISPATCH_VETO", {
                "agent_role": agent_role,
                "task_id": task.task_id,
                "reason": "Agent blocked by Themis",
            })
            return False
        
        # Dispatch to agent
        if not self.dispatcher.dispatch_to_agent(task, agent_role):
            logger.error(f"Failed to dispatch {task.task_id} to {agent_role}")
            return False
        
        # Update states
        self.state.update_task_state(task.task_id, "ASSIGNED", assigned_to=agent_role)
        self.state.assign_agent_to_issue(task.issue_id, agent_role)
        
        # Themis audit
        self._audit_log("DISPATCH_AGENT", {
            "task_id": task.task_id,
            "agent_role": agent_role,
            "issue_id": task.issue_id,
        })
        
        logger.info(f"Task {task.task_id} → Agent {agent_role}")
        return True
    
    def start_task(self, task: Task) -> bool:
        """Transition task to IN_PROGRESS."""
        if not self.dispatcher.start_task(task):
            return False
        
        self.state.update_task_state(task.task_id, "IN_PROGRESS")
        self.registry.update_status(task.assigned_to, AgentStatus.BUSY)
        
        logger.info(f"Task {task.task_id} started (Agent: {task.assigned_to})")
        return True
    
    def complete_task(self, task: Task, result: Optional[Dict] = None) -> None:
        """
        Complete a task and trigger callback.
        
        Args:
            task: Completed Task
            result: Optional result data
        """
        if not self.dispatcher.complete_task(task, result):
            logger.error(f"Failed to complete task {task.task_id}")
            return
        
        self.state.update_task_state(task.task_id, "COMPLETE")
        if task.assigned_to:
            self.registry.update_status(task.assigned_to, AgentStatus.IDLE)
            self.registry.increment_tasks_completed(task.assigned_to)
            self.state.increment_agent_stats(task.assigned_to, success=True)
        
        # Themis audit
        self._audit_log("TASK_COMPLETE", {
            "task_id": task.task_id,
            "issue_id": task.issue_id,
            "agent": task.assigned_to,
        })
        
        # Trigger callback
        if task.task_id in self._callbacks:
            try:
                callback = self._callbacks.pop(task.task_id)
                callback(task, result)
            except Exception as e:
                logger.error(f"Callback failed for {task.task_id}: {e}")
        
        logger.info(f"Task {task.task_id} completed")
    
    def fail_task(self, task: Task, error: str) -> None:
        """
        Handle task failure. Retry if possible, otherwise DLQ.
        
        Args:
            task: Failed Task
            error: Error message
        """
        will_retry = self.dispatcher.fail_task(task, error)
        
        self.state.update_task_state(
            task.task_id,
            "QUEUED" if will_retry else "FAILED",
            error=error,
        )
        if task.assigned_to:
            self.registry.update_status(task.assigned_to, AgentStatus.IDLE)
            if not will_retry:
                self.state.increment_agent_stats(task.assigned_to, success=False)
        
        if will_retry:
            logger.warning(f"Task {task.task_id} failed, retrying (attempt {task.retries})")
        else:
            logger.error(f"Task {task.task_id} failed after {task.max_retries} retries: {error}")
            self._post_mortem(task, error)
        
        # Themis notification
        self._audit_log("TASK_FAIL", {
            "task_id": task.task_id,
            "issue_id": task.issue_id,
            "agent": task.assigned_to,
            "error": error,
            "retrying": will_retry,
        })
    
    # =========================
    # Monitoring
    # =========================
    
    def start_monitoring(self) -> None:
        """Start background monitoring thread."""
        if self._monitor_thread:
            return
        
        self._running = True
        self._monitor_thread = threading.Thread(
            target=self._monitor_loop,
            daemon=True,
        )
        self._monitor_thread.start()
        logger.info("Monitoring thread started")
    
    def stop_monitoring(self) -> None:
        """Stop background monitoring thread."""
        self._running = False
        if self._monitor_thread:
            self._monitor_thread.join(timeout=5)
        logger.info("Monitoring thread stopped")
    
    def _monitor_loop(self) -> None:
        """Background monitoring loop (check timeouts, heartbeats)."""
        while self._running:
            try:
                # Check for timed-out tasks
                timed_out = self.dispatcher.check_timeouts()
                for task_id in timed_out:
                    task = self.dispatcher.get_task(task_id)
                    if task:
                        self.fail_task(task, "Task timeout exceeded")
                        logger.warning(f"Task {task_id} timed out")
                
                # Check agent heartbeats
                dead_agents = self.registry.get_dead_agents(timeout_seconds=60)
                for agent in dead_agents:
                    logger.warning(f"Agent '{agent.role}' heartbeat lost")
                    self.registry.update_status(agent.role, AgentStatus.BLOCKED)
                
                time.sleep(1)  # Check every second
            except Exception as e:
                logger.error(f"Monitor loop error: {e}")
    
    # =========================
    # Error Recovery
    # =========================
    
    def _post_mortem(self, task: Task, error: str) -> None:
        """
        Analyze a failed task and generate post-mortem report.
        
        Args:
            task: Failed task
            error: Error message
        """
        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "task_id": task.task_id,
            "issue_id": task.issue_id,
            "assigned_to": task.assigned_to,
            "task_type": task.task_type,
            "error": error,
            "elapsed_seconds": task.elapsed_seconds(),
            "retries": task.retries,
            "metadata": task.metadata,
        }
        
        with self._lock:
            self._post_mortems.append(report)
        
        logger.info(f"Post-mortem: {json.dumps(report)}")
    
    def get_post_mortems(self) -> List[Dict]:
        """Get all post-mortem reports."""
        with self._lock:
            return list(self._post_mortems)
    
    # =========================
    # Themis Integration
    # =========================
    
    def _audit_log(self, event: str, details: Dict) -> None:
        """
        Log event to Themis audit trail.
        
        Args:
            event: Event type
            details: Event details
        """
        audit_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event": event,
            "details": details,
        }
        logger.info(f"Audit: {event} - {json.dumps(details)}")
        # TODO: integrate with actual Themis API
    
    def themis_veto_agent(self, agent_role: str) -> bool:
        """
        Themis veto: block an agent from accepting new tasks.
        
        Args:
            agent_role: Agent to block
        
        Returns:
            True if blocked, False if agent not found
        """
        if self.registry.update_status(agent_role, AgentStatus.BLOCKED):
            logger.warning(f"Agent '{agent_role}' blocked by Themis veto")
            self._audit_log("THEMIS_VETO", {"agent_role": agent_role})
            return True
        return False
    
    def themis_clear_agent(self, agent_role: str) -> bool:
        """
        Themis clearance: allow agent to resume work.
        
        Args:
            agent_role: Agent to unblock
        
        Returns:
            True if cleared, False if agent not found
        """
        if self.registry.update_status(agent_role, AgentStatus.IDLE):
            logger.info(f"Agent '{agent_role}' cleared by Themis")
            self._audit_log("THEMIS_CLEAR", {"agent_role": agent_role})
            return True
        return False
    
    # =========================
    # State Management
    # =========================
    
    def snapshot(self) -> Dict:
        """Take a snapshot of entire orchestrator state."""
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "registry": self.registry.snapshot(),
            "dispatcher": self.dispatcher.snapshot(),
            "state": self.state.to_dict(),
            "post_mortems_count": len(self._post_mortems),
        }
    
    def graceful_shutdown(self, timeout_seconds: float = 30.0) -> bool:
        """
        Graceful shutdown: wait for in-flight tasks, dump state.
        
        Args:
            timeout_seconds: Max time to wait for tasks
        
        Returns:
            True if shutdown clean, False if timed out
        """
        logger.info("Graceful shutdown initiated")
        self._running = False
        
        start_time = time.time()
        while self.dispatcher.get_in_progress_count() > 0:
            elapsed = time.time() - start_time
            if elapsed > timeout_seconds:
                logger.warning(f"Shutdown timeout after {elapsed}s")
                return False
            
            in_progress_count = self.dispatcher.get_in_progress_count()
            logger.info(f"Waiting for {in_progress_count} tasks to complete...")
            time.sleep(0.5)
        
        # Dump state
        state_dump = self.snapshot()
        logger.info(f"Final state: {json.dumps(state_dump, indent=2)}")
        
        logger.info("Graceful shutdown complete")
        return True

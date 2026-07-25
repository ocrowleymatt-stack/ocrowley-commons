"""
Task Dispatcher — Route GitHub issues to agents based on capability matching.

Implements:
- Task state machine (QUEUED → ASSIGNED → IN_PROGRESS → COMPLETE/FAILED)
- Priority queuing (HIGH > MEDIUM > LOW)
- Timeout handling (30s default, configurable)
- Retry logic (up to 3 attempts with exponential backoff)
- Dead-letter queue (DLQ) for unrecoverable failures
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Callable
import threading
import uuid
import time
from datetime import datetime
from collections import deque


class TaskPriority(Enum):
    """Task priority levels."""
    LOW = 3
    MEDIUM = 2
    HIGH = 1


class TaskState(Enum):
    """Task execution state."""
    QUEUED = "QUEUED"           # Waiting in queue
    ASSIGNED = "ASSIGNED"       # Assigned to agent, not yet started
    IN_PROGRESS = "IN_PROGRESS" # Agent is executing
    COMPLETE = "COMPLETE"       # Successfully completed
    FAILED = "FAILED"           # Failed after retries
    CANCELLED = "CANCELLED"     # Manually cancelled


@dataclass
class Task:
    """Represents a single unit of work (GitHub issue → agent)."""
    task_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    issue_id: int = 0
    task_type: str = ""         # "feature", "bugfix", "review", "memory", etc.
    assigned_to: Optional[str] = None  # Agent role name
    state: TaskState = TaskState.QUEUED
    priority: TaskPriority = TaskPriority.MEDIUM
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    retries: int = 0            # Number of retry attempts
    max_retries: int = 3
    timeout_seconds: float = 30.0
    metadata: Dict = field(default_factory=dict)
    error: Optional[str] = None
    
    def elapsed_seconds(self) -> float:
        """Time elapsed since task creation."""
        return time.time() - self.created_at
    
    def execution_time_seconds(self) -> Optional[float]:
        """Time elapsed from start to completion (if completed)."""
        if not self.started_at:
            return None
        end_time = self.completed_at or time.time()
        return end_time - self.started_at
    
    def is_timed_out(self) -> bool:
        """Check if task has exceeded timeout while IN_PROGRESS."""
        if self.state != TaskState.IN_PROGRESS or not self.started_at:
            return False
        return (time.time() - self.started_at) > self.timeout_seconds
    
    def to_dict(self) -> Dict:
        """Serialize to dict."""
        return {
            "task_id": self.task_id,
            "issue_id": self.issue_id,
            "task_type": self.task_type,
            "assigned_to": self.assigned_to,
            "state": self.state.value,
            "priority": self.priority.name,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "elapsed_seconds": self.elapsed_seconds(),
            "execution_time_seconds": self.execution_time_seconds(),
            "retries": self.retries,
            "max_retries": self.max_retries,
            "timeout_seconds": self.timeout_seconds,
            "is_timed_out": self.is_timed_out(),
            "error": self.error,
        }


class TaskDispatcher:
    """
    Central task routing and state machine.
    
    - Queues tasks by priority (HIGH > MEDIUM > LOW)
    - Matches agents to tasks by capability
    - Tracks task state transitions
    - Handles timeouts and retries
    - Maintains dead-letter queue
    """
    
    def __init__(self):
        self._queues: Dict[TaskPriority, deque] = {
            TaskPriority.HIGH: deque(),
            TaskPriority.MEDIUM: deque(),
            TaskPriority.LOW: deque(),
        }
        self._in_progress: Dict[str, Task] = {}  # task_id → Task
        self._completed: Dict[str, Task] = {}    # task_id → Task
        self._dlq: List[Task] = []               # Dead-letter queue
        self._lock = threading.RLock()
        self._capability_map: Dict[str, List[str]] = {}  # task_type → [agent_roles]
    
    def register_capability_mapping(self, task_type: str, agent_roles: List[str]) -> None:
        """
        Register which agents can handle a given task type.
        
        Args:
            task_type: Task type string (e.g., "feature", "review")
            agent_roles: List of agent roles that can handle this type
        """
        with self._lock:
            self._capability_map[task_type] = agent_roles
    
    def enqueue_task(self, issue_id: int, task_type: str, 
                     priority: TaskPriority = TaskPriority.MEDIUM,
                     timeout_seconds: float = 30.0,
                     metadata: Optional[Dict] = None) -> Task:
        """
        Create and enqueue a new task.
        
        Args:
            issue_id: GitHub issue ID
            task_type: Task type (e.g., "feature")
            priority: TaskPriority enum
            timeout_seconds: Task timeout (default 30s)
            metadata: Optional custom metadata
        
        Returns:
            Created Task instance
        """
        with self._lock:
            task = Task(
                issue_id=issue_id,
                task_type=task_type,
                priority=priority,
                timeout_seconds=timeout_seconds,
                metadata=metadata or {},
            )
            self._queues[priority].append(task)
            return task
    
    def dequeue_next_task(self) -> Optional[Task]:
        """
        Dequeue the next task by priority (HIGH → MEDIUM → LOW).
        
        Returns:
            Next Task or None if all queues empty
        """
        with self._lock:
            for priority in [TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW]:
                if self._queues[priority]:
                    return self._queues[priority].popleft()
            return None
    
    def dispatch_to_agent(self, task: Task, agent_role: str) -> bool:
        """
        Assign a task to an agent and transition to ASSIGNED state.
        
        Args:
            task: Task to dispatch
            agent_role: Agent role to assign to
        
        Returns:
            True if dispatched, False if task already assigned/completed
        """
        with self._lock:
            if task.state not in [TaskState.QUEUED, TaskState.FAILED]:
                return False
            
            task.assigned_to = agent_role
            task.state = TaskState.ASSIGNED
            return True
    
    def start_task(self, task: Task) -> bool:
        """Transition task from ASSIGNED to IN_PROGRESS."""
        with self._lock:
            if task.state != TaskState.ASSIGNED:
                return False
            
            task.state = TaskState.IN_PROGRESS
            task.started_at = time.time()
            self._in_progress[task.task_id] = task
            return True
    
    def complete_task(self, task: Task, result: Optional[Dict] = None) -> bool:
        """Transition task from IN_PROGRESS to COMPLETE."""
        with self._lock:
            if task.state != TaskState.IN_PROGRESS:
                return False
            
            task.state = TaskState.COMPLETE
            task.completed_at = time.time()
            if result:
                task.metadata.update(result)
            self._in_progress.pop(task.task_id, None)
            self._completed[task.task_id] = task
            return True
    
    def fail_task(self, task: Task, error: str) -> bool:
        """
        Fail a task. If retries remaining, re-queue for retry.
        Otherwise, move to DLQ.
        
        Args:
            task: Task that failed
            error: Error message
        
        Returns:
            True if task queued for retry, False if moved to DLQ
        """
        with self._lock:
            task.state = TaskState.FAILED
            task.completed_at = time.time()
            task.error = error
            self._in_progress.pop(task.task_id, None)
            
            # Increment retries count
            task.retries += 1
            
            # Retry logic: exponential backoff (1s, 2s, 4s)
            # Allow retries if we haven't exceeded max_retries
            if task.retries < task.max_retries:
                task.state = TaskState.QUEUED
                task.assigned_to = None
                task.started_at = None
                backoff_seconds = 2 ** (task.retries - 1)
                # TODO: implement actual backoff (schedule retry in future)
                self._queues[task.priority].append(task)
                return True
            else:
                # No more retries; move to DLQ
                self._dlq.append(task)
                return False
    
    def cancel_task(self, task_id: str) -> bool:
        """Cancel a task (if not yet started or in progress)."""
        with self._lock:
            # Search in queues
            for priority, queue in self._queues.items():
                for i, task in enumerate(queue):
                    if task.task_id == task_id:
                        task.state = TaskState.CANCELLED
                        queue.remove(task)
                        self._completed[task_id] = task
                        return True
            
            # Check in-progress
            if task_id in self._in_progress:
                task = self._in_progress.pop(task_id)
                task.state = TaskState.CANCELLED
                task.completed_at = time.time()
                self._completed[task_id] = task
                return True
            
            return False
    
    def check_timeouts(self) -> List[str]:
        """
        Check for timed-out tasks in IN_PROGRESS state.
        
        Returns:
            List of timed-out task IDs
        """
        with self._lock:
            timed_out = []
            for task_id, task in list(self._in_progress.items()):
                if task.is_timed_out():
                    timed_out.append(task_id)
                    # Fail task (which may trigger retry or DLQ)
                    self.fail_task(task, f"Timeout exceeded: {task.timeout_seconds}s")
            return timed_out
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """Get task by ID (searches in-progress, completed, DLQ)."""
        with self._lock:
            if task_id in self._in_progress:
                return self._in_progress[task_id]
            if task_id in self._completed:
                return self._completed[task_id]
            for task in self._dlq:
                if task.task_id == task_id:
                    return task
            return None
    
    def get_queue_size(self, priority: Optional[TaskPriority] = None) -> int:
        """Get queue size (optionally filtered by priority)."""
        with self._lock:
            if priority:
                return len(self._queues[priority])
            return sum(len(q) for q in self._queues.values())
    
    def get_in_progress_count(self) -> int:
        """Get count of IN_PROGRESS tasks."""
        return len(self._in_progress)
    
    def get_dlq(self) -> List[Task]:
        """Get dead-letter queue."""
        return list(self._dlq)
    
    def snapshot(self) -> Dict:
        """Take a snapshot of dispatcher state."""
        with self._lock:
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "queued_count": self.get_queue_size(),
                "in_progress_count": len(self._in_progress),
                "completed_count": len(self._completed),
                "dlq_count": len(self._dlq),
                "queued_by_priority": {
                    "HIGH": len(self._queues[TaskPriority.HIGH]),
                    "MEDIUM": len(self._queues[TaskPriority.MEDIUM]),
                    "LOW": len(self._queues[TaskPriority.LOW]),
                },
                "in_progress_tasks": [t.task_id for t in self._in_progress.values()],
            }

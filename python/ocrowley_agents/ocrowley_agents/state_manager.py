"""
State Manager — Global state tracking and snapshots for the orchestrator.

Manages:
- Per-issue state (GitHub issue context, status)
- Per-agent state (busy, idle, blocked)
- Per-task state (queued, in-progress, complete, failed)
- Memory references (links to Morpheus memory system)
- Immutable history (append-only audit trail)
- Snapshot/restore (for recovery)
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
import threading
import time
import json
from datetime import datetime
from copy import deepcopy


@dataclass
class IssueState:
    """State of a GitHub issue being processed."""
    issue_id: int
    title: str = ""
    status: str = "QUEUED"  # QUEUED, IN_PROGRESS, REVIEW, COMPLETE, FAILED
    priority: str = "MEDIUM"
    assigned_agents: List[str] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    metadata: Dict = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "issue_id": self.issue_id,
            "title": self.title,
            "status": self.status,
            "priority": self.priority,
            "assigned_agents": self.assigned_agents,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "metadata": self.metadata,
        }


@dataclass
class AgentState:
    """State of a single agent."""
    role: str
    is_busy: bool = False
    current_task_id: Optional[str] = None
    last_updated: float = field(default_factory=time.time)
    tasks_completed: int = 0
    tasks_failed: int = 0
    metadata: Dict = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "role": self.role,
            "is_busy": self.is_busy,
            "current_task_id": self.current_task_id,
            "last_updated": self.last_updated,
            "tasks_completed": self.tasks_completed,
            "tasks_failed": self.tasks_failed,
            "metadata": self.metadata,
        }


@dataclass
class TaskState:
    """State of a single task."""
    task_id: str
    issue_id: int
    assigned_to: Optional[str] = None
    state: str = "QUEUED"  # QUEUED, ASSIGNED, IN_PROGRESS, COMPLETE, FAILED
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    retries: int = 0
    error: Optional[str] = None
    metadata: Dict = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "task_id": self.task_id,
            "issue_id": self.issue_id,
            "assigned_to": self.assigned_to,
            "state": self.state,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "retries": self.retries,
            "error": self.error,
            "metadata": self.metadata,
        }


@dataclass
class StateSnapshot:
    """Immutable snapshot of entire system state."""
    timestamp: float = field(default_factory=time.time)
    snapshot_id: str = ""  # UUID
    issues: Dict[int, IssueState] = field(default_factory=dict)
    agents: Dict[str, AgentState] = field(default_factory=dict)
    tasks: Dict[str, TaskState] = field(default_factory=dict)
    memory_refs: Dict[str, str] = field(default_factory=dict)  # task_id → memory_entry_id
    
    def to_dict(self) -> Dict:
        return {
            "timestamp": self.timestamp,
            "snapshot_id": self.snapshot_id,
            "issues": {k: v.to_dict() for k, v in self.issues.items()},
            "agents": {k: v.to_dict() for k, v in self.agents.items()},
            "tasks": {k: v.to_dict() for k, v in self.tasks.items()},
            "memory_refs": self.memory_refs,
        }


@dataclass
class StateTransition:
    """Record of a state change (immutable history entry)."""
    timestamp: float
    transition_type: str  # "issue_update", "agent_update", "task_update"
    entity_id: str       # issue_id, agent_role, or task_id
    from_state: str
    to_state: str
    details: Dict = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "timestamp": self.timestamp,
            "transition_type": self.transition_type,
            "entity_id": self.entity_id,
            "from_state": self.from_state,
            "to_state": self.to_state,
            "details": self.details,
        }


class StateManager:
    """
    Central state management for the orchestrator.
    
    - Tracks global state (issues, agents, tasks)
    - Maintains immutable history (append-only)
    - Supports snapshots and restoration
    - Thread-safe
    """
    
    def __init__(self):
        self._issues: Dict[int, IssueState] = {}
        self._agents: Dict[str, AgentState] = {}
        self._tasks: Dict[str, TaskState] = {}
        self._memory_refs: Dict[str, str] = {}  # task_id → memory_entry_id
        self._history: List[StateTransition] = []  # Immutable audit trail
        self._snapshots: List[StateSnapshot] = []  # Immutable snapshots
        self._lock = threading.RLock()
    
    # =========================
    # Issue State Management
    # =========================
    
    def create_issue_state(self, issue_id: int, title: str = "", 
                          priority: str = "MEDIUM") -> IssueState:
        """Create state for a new GitHub issue."""
        with self._lock:
            if issue_id in self._issues:
                raise ValueError(f"Issue state for #{issue_id} already exists")
            
            state = IssueState(
                issue_id=issue_id,
                title=title,
                priority=priority,
            )
            self._issues[issue_id] = state
            return state
    
    def update_issue_state(self, issue_id: int, status: str, 
                          metadata: Optional[Dict] = None) -> bool:
        """Update issue status and metadata."""
        with self._lock:
            if issue_id not in self._issues:
                return False
            
            issue = self._issues[issue_id]
            old_status = issue.status
            issue.status = status
            issue.updated_at = time.time()
            if metadata:
                issue.metadata.update(metadata)
            
            # Record transition
            self._history.append(StateTransition(
                timestamp=time.time(),
                transition_type="issue_update",
                entity_id=str(issue_id),
                from_state=old_status,
                to_state=status,
            ))
            return True
    
    def get_issue_state(self, issue_id: int) -> Optional[IssueState]:
        """Get state for a specific issue."""
        return self._issues.get(issue_id)
    
    def assign_agent_to_issue(self, issue_id: int, agent_role: str) -> bool:
        """Assign an agent to an issue."""
        with self._lock:
            if issue_id not in self._issues:
                return False
            
            issue = self._issues[issue_id]
            if agent_role not in issue.assigned_agents:
                issue.assigned_agents.append(agent_role)
                issue.updated_at = time.time()
            return True
    
    # =========================
    # Agent State Management
    # =========================
    
    def create_agent_state(self, role: str) -> AgentState:
        """Create state for a new agent."""
        with self._lock:
            if role in self._agents:
                raise ValueError(f"Agent state for '{role}' already exists")
            
            state = AgentState(role=role)
            self._agents[role] = state
            return state
    
    def update_agent_state(self, role: str, is_busy: bool, 
                          current_task_id: Optional[str] = None) -> bool:
        """Update agent busy/idle state."""
        with self._lock:
            if role not in self._agents:
                return False
            
            agent = self._agents[role]
            old_state = "BUSY" if agent.is_busy else "IDLE"
            agent.is_busy = is_busy
            agent.current_task_id = current_task_id
            agent.last_updated = time.time()
            
            new_state = "BUSY" if is_busy else "IDLE"
            if old_state != new_state:
                self._history.append(StateTransition(
                    timestamp=time.time(),
                    transition_type="agent_update",
                    entity_id=role,
                    from_state=old_state,
                    to_state=new_state,
                ))
            return True
    
    def increment_agent_stats(self, role: str, success: bool) -> bool:
        """Increment task counters for an agent."""
        with self._lock:
            if role not in self._agents:
                return False
            
            agent = self._agents[role]
            if success:
                agent.tasks_completed += 1
            else:
                agent.tasks_failed += 1
            agent.last_updated = time.time()
            return True
    
    def get_agent_state(self, role: str) -> Optional[AgentState]:
        """Get state for a specific agent."""
        return self._agents.get(role)
    
    # =========================
    # Task State Management
    # =========================
    
    def create_task_state(self, task_id: str, issue_id: int) -> TaskState:
        """Create state for a new task."""
        with self._lock:
            if task_id in self._tasks:
                raise ValueError(f"Task state for '{task_id}' already exists")
            
            state = TaskState(task_id=task_id, issue_id=issue_id)
            self._tasks[task_id] = state
            return state
    
    def update_task_state(self, task_id: str, state: str, 
                         assigned_to: Optional[str] = None,
                         error: Optional[str] = None,
                         metadata: Optional[Dict] = None) -> bool:
        """Update task state."""
        with self._lock:
            if task_id not in self._tasks:
                return False
            
            task = self._tasks[task_id]
            old_state = task.state
            task.state = state
            task.updated_at = time.time()
            if assigned_to is not None:
                task.assigned_to = assigned_to
            if error is not None:
                task.error = error
            if metadata:
                task.metadata.update(metadata)
            
            # Record transition
            self._history.append(StateTransition(
                timestamp=time.time(),
                transition_type="task_update",
                entity_id=task_id,
                from_state=old_state,
                to_state=state,
                details={"assigned_to": assigned_to, "error": error},
            ))
            return True
    
    def increment_task_retries(self, task_id: str) -> bool:
        """Increment retry counter for a task."""
        with self._lock:
            if task_id not in self._tasks:
                return False
            
            self._tasks[task_id].retries += 1
            self._tasks[task_id].updated_at = time.time()
            return True
    
    def get_task_state(self, task_id: str) -> Optional[TaskState]:
        """Get state for a specific task."""
        return self._tasks.get(task_id)
    
    # =========================
    # Memory References
    # =========================
    
    def link_memory_entry(self, task_id: str, memory_entry_id: str) -> None:
        """Link a Morpheus memory entry to a task."""
        with self._lock:
            self._memory_refs[task_id] = memory_entry_id
    
    def get_memory_reference(self, task_id: str) -> Optional[str]:
        """Get Morpheus memory entry ID for a task."""
        return self._memory_refs.get(task_id)
    
    # =========================
    # Snapshots & History
    # =========================
    
    def create_snapshot(self, snapshot_id: str) -> StateSnapshot:
        """Create an immutable snapshot of entire state."""
        with self._lock:
            snapshot = StateSnapshot(
                snapshot_id=snapshot_id,
                issues={k: deepcopy(v) for k, v in self._issues.items()},
                agents={k: deepcopy(v) for k, v in self._agents.items()},
                tasks={k: deepcopy(v) for k, v in self._tasks.items()},
                memory_refs=dict(self._memory_refs),
            )
            self._snapshots.append(snapshot)
            return snapshot
    
    def restore_snapshot(self, snapshot: StateSnapshot) -> None:
        """Restore system state from a snapshot."""
        with self._lock:
            self._issues = {k: deepcopy(v) for k, v in snapshot.issues.items()}
            self._agents = {k: deepcopy(v) for k, v in snapshot.agents.items()}
            self._tasks = {k: deepcopy(v) for k, v in snapshot.tasks.items()}
            self._memory_refs = dict(snapshot.memory_refs)
    
    def get_history(self, limit: Optional[int] = None) -> List[StateTransition]:
        """Get state transition history (immutable)."""
        history = list(self._history)
        if limit:
            return history[-limit:]
        return history
    
    def get_snapshots(self) -> List[StateSnapshot]:
        """Get all snapshots."""
        return list(self._snapshots)
    
    # =========================
    # Queries
    # =========================
    
    def get_active_issues(self) -> List[IssueState]:
        """Get issues in QUEUED or IN_PROGRESS state."""
        return [i for i in self._issues.values() 
                if i.status in ["QUEUED", "IN_PROGRESS"]]
    
    def get_busy_agents(self) -> List[AgentState]:
        """Get all BUSY agents."""
        return [a for a in self._agents.values() if a.is_busy]
    
    def get_failed_tasks(self) -> List[TaskState]:
        """Get all FAILED tasks."""
        return [t for t in self._tasks.values() if t.state == "FAILED"]
    
    # =========================
    # Serialization
    # =========================
    
    def to_dict(self) -> Dict:
        """Serialize entire state to dict."""
        return {
            "issues": {k: v.to_dict() for k, v in self._issues.items()},
            "agents": {k: v.to_dict() for k, v in self._agents.items()},
            "tasks": {k: v.to_dict() for k, v in self._tasks.items()},
            "memory_refs": self._memory_refs,
            "history_length": len(self._history),
            "snapshots_count": len(self._snapshots),
        }

"""
Agent Registry — Central discovery and status tracking for all 8 Daedalus roles.

Provides thread-safe registration, discovery, and status updates for:
- Aegis (safety gate)
- Iris (audit inspector)
- Themis (approval authority)
- Morpheus (memory system)
- Athena (planner/strategist)
- Argus (monitor/observer)
- Daedalus (orchestrator/coordinator)
- Mnemosyne (persistence/memory)

Thread-safe reads; serialized writes via lock.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set
import threading
import time
from datetime import datetime


class AgentStatus(Enum):
    """Agent operational status."""
    IDLE = "IDLE"           # Available for work
    BUSY = "BUSY"           # Currently executing a task
    BLOCKED = "BLOCKED"     # Cannot accept work (Themis veto)
    UNKNOWN = "UNKNOWN"     # Not yet registered or heartbeat lost


@dataclass
class Agent:
    """Represents a single Daedalus agent."""
    role: str                    # "Aegis", "Iris", "Themis", etc.
    capabilities: Set[str]      # {"safety_check", "approval", ...}
    status: AgentStatus = AgentStatus.IDLE
    last_heartbeat: float = field(default_factory=time.time)
    metadata: Dict = field(default_factory=dict)  # Custom data
    tasks_completed: int = 0                        # Completed task count
    
    def __hash__(self):
        return hash(self.role)
    
    def __eq__(self, other):
        return self.role == other.role if isinstance(other, Agent) else False
    
    def is_alive(self, timeout_seconds: float = 60.0) -> bool:
        """Check if agent is responsive (heartbeat within timeout)."""
        elapsed = time.time() - self.last_heartbeat
        return elapsed < timeout_seconds
    
    def to_dict(self) -> Dict:
        """Serialize to dict."""
        return {
            "role": self.role,
            "capabilities": sorted(list(self.capabilities)),
            "status": self.status.value,
            "last_heartbeat": self.last_heartbeat,
            "is_alive": self.is_alive(),
            "metadata": self.metadata,
        }


class AgentRegistry:
    """
    Central registry for all agents.
    
    Thread-safe: RLock for write operations, concurrent reads allowed.
    """
    
    # Canonical 8 roles
    CANONICAL_ROLES = {
        "Aegis",      # Safety gate
        "Iris",       # Audit inspector
        "Themis",     # Approval authority
        "Morpheus",   # Memory system
        "Athena",     # Planner
        "Argus",      # Monitor
        "Daedalus",   # Orchestrator
        "Mnemosyne",  # Persistence
    }
    
    def __init__(self):
        self._agents: Dict[str, Agent] = {}  # role → Agent
        self._lock = threading.RLock()
        self._created_at = time.time()
    
    def register(self, role: str, capabilities: Set[str], 
                 metadata: Optional[Dict] = None) -> Agent:
        """
        Register a new agent.
        
        Args:
            role: Agent role name (e.g., "Aegis")
            capabilities: Set of capability strings (e.g., {"safety_check"})
            metadata: Optional custom metadata
        
        Returns:
            Registered Agent instance
        
        Raises:
            ValueError: If role already registered or role not in canonical set
        """
        with self._lock:
            if role in self._agents:
                raise ValueError(f"Agent '{role}' already registered")
            
            if role not in self.CANONICAL_ROLES:
                raise ValueError(f"Unknown role '{role}'. Must be one of: {self.CANONICAL_ROLES}")
            
            agent = Agent(
                role=role,
                capabilities=set(capabilities) if capabilities else set(),
                metadata=metadata or {},
            )
            self._agents[role] = agent
            return agent
    
    def unregister(self, role: str) -> bool:
        """Remove an agent from the registry."""
        with self._lock:
            if role in self._agents:
                del self._agents[role]
                return True
            return False
    
    def get(self, role: str) -> Optional[Agent]:
        """Get agent by role name (thread-safe read)."""
        return self._agents.get(role)
    
    def get_all(self) -> List[Agent]:
        """Get all registered agents (thread-safe read)."""
        return list(self._agents.values())
    
    def get_by_capability(self, capability: str) -> List[Agent]:
        """Find all agents with a given capability."""
        return [a for a in self._agents.values() if capability in a.capabilities]
    
    def get_by_status(self, status: AgentStatus) -> List[Agent]:
        """Find all agents with a given status."""
        return [a for a in self._agents.values() if a.status == status]
    
    def get_available(self) -> List[Agent]:
        """Get all IDLE agents (available to accept tasks)."""
        return self.get_by_status(AgentStatus.IDLE)
    
    def update_status(self, role: str, status: AgentStatus) -> bool:
        """
        Update agent status (thread-safe write).
        
        Args:
            role: Agent role
            status: New AgentStatus
        
        Returns:
            True if updated, False if agent not found
        """
        with self._lock:
            agent = self._agents.get(role)
            if agent:
                agent.status = status
                agent.last_heartbeat = time.time()
                return True
            return False
    
    def increment_tasks_completed(self, role: str) -> bool:
        """
        Increment completed task count for an agent.
        
        Args:
            role: Agent role
        
        Returns:
            True if incremented, False if agent not found
        """
        with self._lock:
            agent = self._agents.get(role)
            if agent:
                agent.tasks_completed += 1
                return True
            return False
    
    def heartbeat(self, role: str) -> bool:
        """
        Refresh agent heartbeat (proof of life).
        
        Args:
            role: Agent role
        
        Returns:
            True if updated, False if agent not found
        """
        with self._lock:
            agent = self._agents.get(role)
            if agent:
                agent.last_heartbeat = time.time()
                return True
            return False
    
    def get_dead_agents(self, timeout_seconds: float = 60.0) -> List[Agent]:
        """Find agents whose heartbeat has expired."""
        return [a for a in self._agents.values() if not a.is_alive(timeout_seconds)]
    
    def add_capability(self, role: str, capability: str) -> bool:
        """Add a capability to an agent."""
        with self._lock:
            agent = self._agents.get(role)
            if agent:
                agent.capabilities.add(capability)
                return True
            return False
    
    def remove_capability(self, role: str, capability: str) -> bool:
        """Remove a capability from an agent."""
        with self._lock:
            agent = self._agents.get(role)
            if agent:
                agent.capabilities.discard(capability)
                return True
            return False
    
    def update_metadata(self, role: str, metadata: Dict) -> bool:
        """Update agent metadata."""
        with self._lock:
            agent = self._agents.get(role)
            if agent:
                agent.metadata.update(metadata)
                return True
            return False
    
    def snapshot(self) -> Dict:
        """Take a snapshot of all agent states (for persistence)."""
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "agents": {role: agent.to_dict() for role, agent in self._agents.items()},
            "uptime_seconds": time.time() - self._created_at,
        }
    
    def __len__(self) -> int:
        """Number of registered agents."""
        return len(self._agents)
    
    def __repr__(self) -> str:
        agents_summary = ", ".join([f"{a.role}:{a.status.value}" for a in self._agents.values()])
        return f"AgentRegistry({agents_summary})"

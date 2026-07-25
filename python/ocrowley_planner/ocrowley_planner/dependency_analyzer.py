"""Dependency analyzer — breaks work into ordered phases with constraints.

Detects:
- Sequential dependencies (X must be done before Y)
- Parallel-capable work (X and Y can be done in parallel)
- Resource conflicts (X and Y cannot run simultaneously)
- Blockers (X is blocked by Y)
- Weak dependencies (X is improved by Y, but not required)
"""

from dataclasses import dataclass, field
from typing import List, Dict, Set
from enum import Enum


class DependencyType(Enum):
    """Relationship between tasks."""
    BLOCKING = "blocking"  # A must complete before B starts
    PARALLEL = "parallel"  # A and B can run simultaneously
    SEQUENTIAL = "sequential"  # A must run before B, but there's flexibility
    WEAK = "weak"  # A improves B, but B can proceed without A


@dataclass
class Task:
    """Single unit of work."""
    id: str  # T1, T2, etc.
    title: str
    description: str
    estimated_time: float = 1.0  # hours
    complexity: str = "medium"  # low, medium, high


@dataclass
class Dependency:
    """Relationship between two tasks."""
    from_task: str  # Task ID
    to_task: str  # Task ID
    dependency_type: DependencyType
    reason: str = ""


@dataclass
class TaskPhase:
    """Ordered phase of tasks."""
    phase_number: int
    title: str
    tasks: List[Task] = field(default_factory=list)
    estimated_duration: float = 0.0
    can_run_in_parallel: bool = True
    blockers: List[str] = field(default_factory=list)


@dataclass
class DependencyGraph:
    """Full task dependency graph with phases."""
    tasks: Dict[str, Task] = field(default_factory=dict)
    dependencies: List[Dependency] = field(default_factory=list)
    phases: List[TaskPhase] = field(default_factory=list)
    has_cycles: bool = False
    cycle_details: str = ""
    
    def add_task(self, task: Task):
        """Add task to graph."""
        self.tasks[task.id] = task
    
    def add_dependency(self, dependency: Dependency):
        """Add dependency edge."""
        self.dependencies.append(dependency)
    
    def topological_sort(self) -> List[str]:
        """Return task IDs in topological order (respecting blocking deps)."""
        # Build adjacency list for blocking dependencies only
        graph = {task_id: [] for task_id in self.tasks.keys()}
        in_degree = {task_id: 0 for task_id in self.tasks.keys()}
        
        for dep in self.dependencies:
            if dep.dependency_type == DependencyType.BLOCKING:
                graph[dep.from_task].append(dep.to_task)
                in_degree[dep.to_task] += 1
        
        # Kahn's algorithm
        queue = [task_id for task_id in self.tasks.keys() if in_degree[task_id] == 0]
        sorted_tasks = []
        
        while queue:
            task = queue.pop(0)
            sorted_tasks.append(task)
            
            for dependent in graph[task]:
                in_degree[dependent] -= 1
                if in_degree[dependent] == 0:
                    queue.append(dependent)
        
        if len(sorted_tasks) != len(self.tasks):
            self.has_cycles = True
            self.cycle_details = "Detected circular dependency"
            return sorted_tasks
        
        return sorted_tasks
    
    def get_phases(self) -> List[TaskPhase]:
        """Group tasks into sequential phases."""
        if self.has_cycles:
            return []
        
        order = self.topological_sort()
        phases = []
        current_phase = 1
        current_phase_tasks = []
        blocked_tasks = set()
        
        for task_id in order:
            # Check if this task is blocked by previous phases
            blockers = [
                dep.from_task for dep in self.dependencies
                if dep.to_task == task_id and 
                   dep.dependency_type == DependencyType.BLOCKING
            ]
            
            if blockers:
                # Start new phase if task is blocked
                if current_phase_tasks:
                    phase = TaskPhase(
                        phase_number=current_phase,
                        title=f"Phase {current_phase}",
                        tasks=current_phase_tasks,
                        estimated_duration=sum(t.estimated_time for t in current_phase_tasks),
                        can_run_in_parallel=True,
                        blockers=blockers
                    )
                    phases.append(phase)
                    current_phase += 1
                    current_phase_tasks = []
                
                blocked_tasks.add(task_id)
            
            current_phase_tasks.append(self.tasks[task_id])
        
        # Add final phase
        if current_phase_tasks:
            phase = TaskPhase(
                phase_number=current_phase,
                title=f"Phase {current_phase}",
                tasks=current_phase_tasks,
                estimated_duration=sum(t.estimated_time for t in current_phase_tasks),
                can_run_in_parallel=True,
                blockers=list(blocked_tasks)
            )
            phases.append(phase)
        
        return phases


class DependencyAnalyzer:
    """Analyzes GitHub issue to extract task dependencies."""
    
    @staticmethod
    def analyze_issue(issue_title: str, issue_body: str, 
                     acceptance_criteria: List[str]) -> DependencyGraph:
        """Extract tasks and dependencies from issue."""
        graph = DependencyGraph()
        
        # Convert acceptance criteria to tasks
        tasks = []
        for i, criterion in enumerate(acceptance_criteria):
            task = Task(
                id=f"T{i+1}",
                title=criterion,
                description=criterion,
                estimated_time=DependencyAnalyzer._estimate_time(criterion),
                complexity=DependencyAnalyzer._estimate_complexity(criterion)
            )
            tasks.append(task)
            graph.add_task(task)
        
        # Detect dependencies from keywords
        for i, criterion in enumerate(acceptance_criteria):
            for j, other in enumerate(acceptance_criteria):
                if i != j:
                    dep_type = DependencyAnalyzer._detect_dependency(criterion, other)
                    if dep_type:
                        graph.add_dependency(
                            Dependency(
                                from_task=f"T{i+1}",
                                to_task=f"T{j+1}",
                                dependency_type=dep_type,
                                reason=f"{criterion} → {other}"
                            )
                        )
        
        graph.phases = graph.get_phases()
        return graph
    
    @staticmethod
    def _estimate_time(criterion: str) -> float:
        """Estimate hours to complete criterion."""
        text = criterion.lower()
        
        # Simple heuristics
        if "simple" in text or "small" in text:
            return 0.5
        elif "add" in text or "update" in text:
            return 1.0
        elif "refactor" in text or "redesign" in text:
            return 3.0
        elif "implement" in text or "build" in text:
            return 2.0
        else:
            return 1.5
    
    @staticmethod
    def _estimate_complexity(criterion: str) -> str:
        """Estimate complexity level."""
        text = criterion.lower()
        
        if any(word in text for word in ["simple", "easy", "trivial", "small"]):
            return "low"
        elif any(word in text for word in ["complex", "intricate", "redesign", "major"]):
            return "high"
        else:
            return "medium"
    
    @staticmethod
    def _detect_dependency(from_criterion: str, to_criterion: str) -> DependencyType:
        """Detect if from_criterion must precede to_criterion."""
        from_lower = from_criterion.lower()
        to_lower = to_criterion.lower()
        
        # Blocking keywords: "before", "first", "then", "after"
        if any(word in to_lower for word in ["after", "once", "when", "following"]):
            if any(word in to_lower for word in ["before", "first", "then"]):
                return DependencyType.BLOCKING
        
        # "Setup" or "initialize" typically blocks other work
        if "setup" in from_lower or "initialize" in from_lower:
            if "implement" in to_lower or "add" in to_lower or "build" in to_lower:
                return DependencyType.BLOCKING
        
        # "Tests" typically come after implementation
        if "implement" in from_lower and "test" in to_lower:
            return DependencyType.SEQUENTIAL
        
        # No detected dependency
        return None

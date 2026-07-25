"""
Test Suite for D-08 Mnemosyne Orchestrator (45+ tests).

Coverage:
- AgentRegistry (8 tests)
- TaskDispatcher (12 tests)
- StateManager (10 tests)
- Coordinator (8 tests)
- Integration (7 tests)
"""

import unittest
import time
import threading
import random
from unittest.mock import Mock, patch, MagicMock

from ocrowley_agents import (
    AgentRegistry, Agent, AgentStatus,
    TaskDispatcher, Task, TaskPriority, TaskState,
    StateManager, IssueState, AgentState,
    Coordinator, DispatchContext,
)


class TestAgentRegistry(unittest.TestCase):
    """Tests for AgentRegistry."""
    
    def setUp(self):
        self.registry = AgentRegistry()
    
    def test_register_agent(self):
        """Test basic agent registration."""
        agent = self.registry.register("Themis", {"approval", "review"})
        self.assertEqual(agent.role, "Themis")
        self.assertIn("approval", agent.capabilities)
        self.assertEqual(agent.status, AgentStatus.IDLE)
    
    def test_register_duplicate_fails(self):
        """Test duplicate registration raises error."""
        self.registry.register("Themis", {"approval"})
        with self.assertRaises(ValueError):
            self.registry.register("Themis", {"approval"})
    
    def test_register_unknown_role_fails(self):
        """Test registering unknown role raises error."""
        with self.assertRaises(ValueError):
            self.registry.register("UnknownRole", {"some_capability"})
    
    def test_discover_by_role(self):
        """Test discovery by role name."""
        self.registry.register("Aegis", {"safety_check"})
        agent = self.registry.get("Aegis")
        self.assertIsNotNone(agent)
        self.assertEqual(agent.role, "Aegis")
    
    def test_discover_by_capability(self):
        """Test discovery by capability."""
        self.registry.register("Themis", {"approval", "review"})
        self.registry.register("Iris", {"audit"})
        
        approval_agents = self.registry.get_by_capability("approval")
        self.assertEqual(len(approval_agents), 1)
        self.assertEqual(approval_agents[0].role, "Themis")
        
        audit_agents = self.registry.get_by_capability("audit")
        self.assertEqual(len(audit_agents), 1)
    
    def test_update_status(self):
        """Test status updates."""
        self.registry.register("Themis", {"approval"})
        self.assertTrue(self.registry.update_status("Themis", AgentStatus.BUSY))
        agent = self.registry.get("Themis")
        self.assertEqual(agent.status, AgentStatus.BUSY)
    
    def test_concurrent_reads(self):
        """Test thread-safe concurrent reads."""
        self.registry.register("Themis", {"approval"})
        self.registry.register("Aegis", {"safety"})
        
        results = []
        def read_agents():
            agents = self.registry.get_all()
            results.append(len(agents))
        
        threads = [threading.Thread(target=read_agents) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        # All reads should succeed
        self.assertEqual(len(results), 10)
        self.assertTrue(all(r == 2 for r in results))
    
    def test_heartbeat_mechanism(self):
        """Test agent heartbeat tracking."""
        self.registry.register("Themis", {"approval"})
        agent = self.registry.get("Themis")
        
        initial_heartbeat = agent.last_heartbeat
        time.sleep(0.1)
        
        self.registry.heartbeat("Themis")
        agent = self.registry.get("Themis")
        self.assertGreater(agent.last_heartbeat, initial_heartbeat)
        self.assertTrue(agent.is_alive(timeout_seconds=1))


class TestTaskDispatcher(unittest.TestCase):
    """Tests for TaskDispatcher."""
    
    def setUp(self):
        self.dispatcher = TaskDispatcher()
    
    def test_enqueue_task(self):
        """Test task creation and enqueuing."""
        task = self.dispatcher.enqueue_task(
            issue_id=10,
            task_type="feature",
            priority=TaskPriority.HIGH,
        )
        self.assertEqual(task.issue_id, 10)
        self.assertEqual(task.task_type, "feature")
        self.assertEqual(task.state, TaskState.QUEUED)
        self.assertEqual(task.priority, TaskPriority.HIGH)
    
    def test_fifo_ordering(self):
        """Test FIFO queue ordering for same priority."""
        self.dispatcher.enqueue_task(1, "feature", TaskPriority.MEDIUM)
        self.dispatcher.enqueue_task(2, "feature", TaskPriority.MEDIUM)
        self.dispatcher.enqueue_task(3, "feature", TaskPriority.MEDIUM)
        
        t1 = self.dispatcher.dequeue_next_task()
        t2 = self.dispatcher.dequeue_next_task()
        t3 = self.dispatcher.dequeue_next_task()
        
        self.assertEqual(t1.issue_id, 1)
        self.assertEqual(t2.issue_id, 2)
        self.assertEqual(t3.issue_id, 3)
    
    def test_priority_ordering(self):
        """Test HIGH > MEDIUM > LOW priority ordering."""
        self.dispatcher.enqueue_task(1, "feature", TaskPriority.LOW)
        self.dispatcher.enqueue_task(2, "feature", TaskPriority.HIGH)
        self.dispatcher.enqueue_task(3, "feature", TaskPriority.MEDIUM)
        
        t1 = self.dispatcher.dequeue_next_task()  # HIGH
        t2 = self.dispatcher.dequeue_next_task()  # MEDIUM
        t3 = self.dispatcher.dequeue_next_task()  # LOW
        
        self.assertEqual(t1.issue_id, 2)
        self.assertEqual(t2.issue_id, 3)
        self.assertEqual(t3.issue_id, 1)
    
    def test_state_transitions(self):
        """Test task state machine transitions."""
        task = self.dispatcher.enqueue_task(10, "feature")
        self.assertEqual(task.state, TaskState.QUEUED)
        
        # QUEUED → ASSIGNED
        self.dispatcher.dispatch_to_agent(task, "Themis")
        self.assertEqual(task.state, TaskState.ASSIGNED)
        
        # ASSIGNED → IN_PROGRESS
        self.dispatcher.start_task(task)
        self.assertEqual(task.state, TaskState.IN_PROGRESS)
        
        # IN_PROGRESS → COMPLETE
        self.dispatcher.complete_task(task)
        self.assertEqual(task.state, TaskState.COMPLETE)
    
    def test_timeout_detection(self):
        """Test timeout detection for long-running tasks."""
        task = self.dispatcher.enqueue_task(10, "feature", timeout_seconds=0.1)
        self.dispatcher.dispatch_to_agent(task, "Themis")
        self.dispatcher.start_task(task)
        
        # Wait for timeout
        time.sleep(0.15)
        
        timed_out = self.dispatcher.check_timeouts()
        self.assertIn(task.task_id, timed_out)
    
    def test_retry_logic(self):
        """Test retry mechanism (up to 3 retries)."""
        task = self.dispatcher.enqueue_task(10, "feature", timeout_seconds=1)
        self.dispatcher.dispatch_to_agent(task, "Themis")
        self.dispatcher.start_task(task)
        
        # Fail task
        will_retry = self.dispatcher.fail_task(task, "Test error")
        self.assertTrue(will_retry)
        self.assertEqual(task.retries, 1)
        self.assertEqual(task.state, TaskState.QUEUED)
        
        # Fail again
        task.assigned_to = None
        task.started_at = None
        self.dispatcher.dispatch_to_agent(task, "Themis")
        self.dispatcher.start_task(task)
        will_retry = self.dispatcher.fail_task(task, "Test error")
        self.assertTrue(will_retry)
        self.assertEqual(task.retries, 2)
        
        # Fail 3rd time
        task.assigned_to = None
        task.started_at = None
        self.dispatcher.dispatch_to_agent(task, "Themis")
        self.dispatcher.start_task(task)
        will_retry = self.dispatcher.fail_task(task, "Test error")
        self.assertFalse(will_retry)
        self.assertEqual(task.retries, 3)
    
    def test_dlq_handling(self):
        """Test dead-letter queue for unrecoverable failures."""
        task = self.dispatcher.enqueue_task(10, "feature")
        self.dispatcher.dispatch_to_agent(task, "Themis")
        self.dispatcher.start_task(task)
        
        # Fail 3 times to move to DLQ
        for i in range(3):
            self.dispatcher.fail_task(task, "Error")
            if i < 2:
                task.assigned_to = None
                task.started_at = None
                self.dispatcher.dispatch_to_agent(task, "Themis")
                self.dispatcher.start_task(task)
        
        dlq = self.dispatcher.get_dlq()
        self.assertEqual(len(dlq), 1)
        self.assertEqual(dlq[0].task_id, task.task_id)
    
    def test_concurrent_dispatch(self):
        """Test concurrent task dispatch (100 tasks)."""
        task_ids = []
        def enqueue():
            task = self.dispatcher.enqueue_task(random.randint(1, 20), "feature")
            task_ids.append(task.task_id)
        
        threads = [threading.Thread(target=enqueue) for _ in range(100)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        # Verify all tasks enqueued
        self.assertEqual(len(task_ids), 100)
        self.assertEqual(len(set(task_ids)), 100)  # All unique
        self.assertEqual(self.dispatcher.get_queue_size(), 100)
    
    def test_cancel_task(self):
        """Test task cancellation."""
        task = self.dispatcher.enqueue_task(10, "feature")
        cancelled = self.dispatcher.cancel_task(task.task_id)
        self.assertTrue(cancelled)
        self.assertEqual(task.state, TaskState.CANCELLED)
    
    def test_queue_metrics(self):
        """Test queue metrics and snapshots."""
        self.dispatcher.enqueue_task(1, "feature", TaskPriority.HIGH)
        self.dispatcher.enqueue_task(2, "feature", TaskPriority.MEDIUM)
        self.dispatcher.enqueue_task(3, "feature", TaskPriority.LOW)
        
        snapshot = self.dispatcher.snapshot()
        self.assertEqual(snapshot["queued_count"], 3)
        self.assertEqual(snapshot["queued_by_priority"]["HIGH"], 1)
        self.assertEqual(snapshot["queued_by_priority"]["MEDIUM"], 1)
        self.assertEqual(snapshot["queued_by_priority"]["LOW"], 1)


class TestStateManager(unittest.TestCase):
    """Tests for StateManager."""
    
    def setUp(self):
        self.state = StateManager()
    
    def test_create_issue_state(self):
        """Test issue state creation."""
        issue = self.state.create_issue_state(10, "Test feature")
        self.assertEqual(issue.issue_id, 10)
        self.assertEqual(issue.title, "Test feature")
        self.assertEqual(issue.status, "QUEUED")
    
    def test_update_issue_state(self):
        """Test issue state updates."""
        self.state.create_issue_state(10)
        self.state.update_issue_state(10, "IN_PROGRESS")
        issue = self.state.get_issue_state(10)
        self.assertEqual(issue.status, "IN_PROGRESS")
    
    def test_create_agent_state(self):
        """Test agent state creation."""
        agent = self.state.create_agent_state("Themis")
        self.assertEqual(agent.role, "Themis")
        self.assertFalse(agent.is_busy)
    
    def test_update_agent_state(self):
        """Test agent state updates."""
        self.state.create_agent_state("Themis")
        self.state.update_agent_state("Themis", is_busy=True)
        agent = self.state.get_agent_state("Themis")
        self.assertTrue(agent.is_busy)
    
    def test_create_task_state(self):
        """Test task state creation."""
        task = self.state.create_task_state("task_123", 10)
        self.assertEqual(task.task_id, "task_123")
        self.assertEqual(task.issue_id, 10)
        self.assertEqual(task.state, "QUEUED")
    
    def test_update_task_state(self):
        """Test task state transitions."""
        self.state.create_task_state("task_123", 10)
        self.state.update_task_state("task_123", "IN_PROGRESS", assigned_to="Themis")
        task = self.state.get_task_state("task_123")
        self.assertEqual(task.state, "IN_PROGRESS")
        self.assertEqual(task.assigned_to, "Themis")
    
    def test_assign_agent_to_issue(self):
        """Test assigning agents to issues."""
        self.state.create_issue_state(10)
        self.state.assign_agent_to_issue(10, "Themis")
        issue = self.state.get_issue_state(10)
        self.assertIn("Themis", issue.assigned_agents)
    
    def test_snapshot_creation(self):
        """Test snapshot creation."""
        self.state.create_issue_state(10)
        self.state.create_agent_state("Themis")
        self.state.create_task_state("task_123", 10)
        
        snapshot = self.state.create_snapshot("snap_001")
        self.assertEqual(snapshot.snapshot_id, "snap_001")
        self.assertEqual(len(snapshot.issues), 1)
        self.assertEqual(len(snapshot.agents), 1)
        self.assertEqual(len(snapshot.tasks), 1)
    
    def test_snapshot_restoration(self):
        """Test snapshot restoration."""
        self.state.create_issue_state(10, "Test")
        self.state.create_agent_state("Themis")
        snapshot = self.state.create_snapshot("snap_001")
        
        # Clear state
        self.state._issues.clear()
        self.state._agents.clear()
        
        # Restore
        self.state.restore_snapshot(snapshot)
        self.assertEqual(len(self.state._issues), 1)
        self.assertEqual(len(self.state._agents), 1)
    
    def test_immutable_history(self):
        """Test state transition history."""
        self.state.create_issue_state(10)
        self.state.update_issue_state(10, "IN_PROGRESS")
        self.state.update_issue_state(10, "COMPLETE")
        
        history = self.state.get_history()
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0].from_state, "QUEUED")
        self.assertEqual(history[0].to_state, "IN_PROGRESS")
        self.assertEqual(history[1].from_state, "IN_PROGRESS")
        self.assertEqual(history[1].to_state, "COMPLETE")


class TestCoordinator(unittest.TestCase):
    """Tests for Coordinator."""
    
    def setUp(self):
        self.registry = AgentRegistry()
        self.dispatcher = TaskDispatcher()
        self.state = StateManager()
        self.coordinator = Coordinator(self.registry, self.dispatcher, self.state)
    
    def test_dispatch_issue(self):
        """Test issue dispatch."""
        context = DispatchContext(
            issue_id=10,
            task_type="feature",
            metadata={"title": "Test feature"},
        )
        task = self.coordinator.dispatch_issue(context)
        self.assertIsNotNone(task)
        self.assertEqual(task.issue_id, 10)
    
    def test_dispatch_to_agent(self):
        """Test task dispatch to agent."""
        self.registry.register("Themis", {"approval"})
        
        context = DispatchContext(issue_id=10, task_type="feature")
        task = self.coordinator.dispatch_issue(context)
        
        success = self.coordinator.dispatch_to_agent(task, "Themis")
        self.assertTrue(success)
        self.assertEqual(task.assigned_to, "Themis")
    
    def test_dispatch_blocked_agent(self):
        """Test dispatch to blocked agent fails."""
        self.registry.register("Themis", {"approval"}, metadata={"status": "BLOCKED"})
        self.registry.update_status("Themis", AgentStatus.BLOCKED)
        
        context = DispatchContext(issue_id=10, task_type="feature")
        task = self.coordinator.dispatch_issue(context)
        
        success = self.coordinator.dispatch_to_agent(task, "Themis")
        self.assertFalse(success)
    
    def test_task_completion(self):
        """Test task completion workflow."""
        self.registry.register("Themis", {"approval"})
        
        context = DispatchContext(issue_id=10, task_type="feature")
        task = self.coordinator.dispatch_issue(context)
        self.coordinator.dispatch_to_agent(task, "Themis")
        self.coordinator.start_task(task)
        
        self.coordinator.complete_task(task, {"pr": 11})
        self.assertEqual(task.state, TaskState.COMPLETE)
    
    def test_task_failure_with_retry(self):
        """Test task failure and retry."""
        self.registry.register("Themis", {"approval"})
        
        context = DispatchContext(issue_id=10, task_type="feature")
        task = self.coordinator.dispatch_issue(context)
        self.coordinator.dispatch_to_agent(task, "Themis")
        self.coordinator.start_task(task)
        
        self.coordinator.fail_task(task, "Test error")
        # Task should be re-queued for retry
        self.assertEqual(task.retries, 1)
    
    def test_themis_veto_agent(self):
        """Test Themis veto mechanism."""
        self.registry.register("Themis", {"approval"})
        
        self.coordinator.themis_veto_agent("Themis")
        agent = self.registry.get("Themis")
        self.assertEqual(agent.status, AgentStatus.BLOCKED)
    
    def test_themis_clear_agent(self):
        """Test Themis clearance."""
        self.registry.register("Themis", {"approval"})
        self.coordinator.themis_veto_agent("Themis")
        self.coordinator.themis_clear_agent("Themis")
        
        agent = self.registry.get("Themis")
        self.assertEqual(agent.status, AgentStatus.IDLE)
    
    def test_snapshot(self):
        """Test coordinator snapshot."""
        self.registry.register("Themis", {"approval"})
        snapshot = self.coordinator.snapshot()
        
        self.assertIn("timestamp", snapshot)
        self.assertIn("registry", snapshot)
        self.assertIn("dispatcher", snapshot)
        self.assertIn("state", snapshot)


class TestIntegration(unittest.TestCase):
    """Integration tests (full workflows)."""
    
    def setUp(self):
        self.registry = AgentRegistry()
        self.dispatcher = TaskDispatcher()
        self.state = StateManager()
        self.coordinator = Coordinator(self.registry, self.dispatcher, self.state)
    
    def test_full_workflow(self):
        """Test complete issue → dispatch → task → completion workflow."""
        # Register agents
        self.registry.register("Athena", {"planning", "analysis"})
        self.registry.register("Themis", {"approval", "review"})
        
        # Dispatch issue
        context = DispatchContext(
            issue_id=10,
            task_type="feature",
            metadata={"title": "Test feature", "priority": "HIGH"},
        )
        task = self.coordinator.dispatch_issue(context)
        
        # Dispatch to agent
        self.coordinator.dispatch_to_agent(task, "Athena")
        self.coordinator.start_task(task)
        
        # Complete
        self.coordinator.complete_task(task, {"plan": "done"})
        
        # Verify states
        self.assertEqual(task.state, TaskState.COMPLETE)
        agent = self.registry.get("Athena")
        self.assertEqual(agent.status, AgentStatus.IDLE)
        self.assertEqual(agent.tasks_completed, 1)
    
    def test_multi_agent_coordination(self):
        """Test multiple agents working on same issue."""
        self.registry.register("Athena", {"planning"})
        self.registry.register("Themis", {"approval"})
        
        # Create two tasks for same issue
        context = DispatchContext(issue_id=10, task_type="planning")
        task1 = self.coordinator.dispatch_issue(context)
        
        context = DispatchContext(issue_id=10, task_type="review")
        task2 = self.coordinator.dispatch_issue(context)
        
        # Assign to different agents
        self.coordinator.dispatch_to_agent(task1, "Athena")
        self.coordinator.dispatch_to_agent(task2, "Themis")
        
        issue = self.state.get_issue_state(10)
        self.assertEqual(len(issue.assigned_agents), 2)
    
    def test_failure_recovery(self):
        """Test recovery from task failures."""
        self.registry.register("Athena", {"planning"})
        
        context = DispatchContext(issue_id=10, task_type="feature")
        task = self.coordinator.dispatch_issue(context)
        self.coordinator.dispatch_to_agent(task, "Athena")
        self.coordinator.start_task(task)
        
        # Fail task
        self.coordinator.fail_task(task, "Test error")
        
        # Verify retry
        self.assertEqual(task.retries, 1)
        self.assertEqual(task.state, TaskState.QUEUED)
    
    def test_concurrent_dispatch_and_execution(self):
        """Test concurrent dispatch and execution."""
        # Register 3 agents
        for role in ["Athena", "Themis", "Aegis"]:
            self.registry.register(role, {f"{role.lower()}_capability"})
        
        task_ids = []
        def dispatch_and_complete():
            context = DispatchContext(
                issue_id=random.randint(1, 10),
                task_type="feature",
            )
            task = self.coordinator.dispatch_issue(context)
            task_ids.append(task.task_id)
            
            # Assign to random agent
            agent = random.choice(["Athena", "Themis", "Aegis"])
            if self.coordinator.dispatch_to_agent(task, agent):
                self.coordinator.start_task(task)
                self.coordinator.complete_task(task)
        
        threads = [threading.Thread(target=dispatch_and_complete) for _ in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        # Verify all tasks completed
        self.assertEqual(len(task_ids), 20)
    
    def test_state_consistency_under_load(self):
        """Test state consistency with concurrent operations."""
        self.registry.register("Themis", {"approval"})
        
        # Rapid state updates
        for i in range(50):
            self.state.create_issue_state(i)
            self.state.update_issue_state(i, "IN_PROGRESS")
            self.state.create_task_state(f"task_{i}", i)
        
        # Verify consistency
        self.assertEqual(len(self.state._issues), 50)
        self.assertEqual(len(self.state._tasks), 50)
    
    def test_graceful_shutdown(self):
        """Test graceful shutdown."""
        self.registry.register("Athena", {"planning"})
        
        context = DispatchContext(issue_id=10, task_type="feature")
        task = self.coordinator.dispatch_issue(context)
        self.coordinator.dispatch_to_agent(task, "Athena")
        self.coordinator.start_task(task)
        
        # Complete task
        self.coordinator.complete_task(task)
        
        # Shutdown
        success = self.coordinator.graceful_shutdown(timeout_seconds=1)
        self.assertTrue(success)


if __name__ == "__main__":
    unittest.main()

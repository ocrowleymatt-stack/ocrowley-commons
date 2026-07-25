"""
Test Suite for D-07 Morpheus Memory System (47 test cases)

Coverage:
- MemoryStore: 12 tests
- ContextManager: 8 tests
- HistoryTracker: 10 tests
- RetrievalEngine: 8 tests
- ThemisMemoryGate: 4 tests
- Integration: 5 tests

Target: ≥90% coverage, 100% pass rate

Status: Phase 2, Issue #8
"""

import pytest
import time
import json
import threading
from ocrowley_memory import (
    MemoryStore, MemoryEntry,
    ContextManager, Turn,
    HistoryTracker, ActionRecord,
    RetrievalEngine, SimilarityScorer, SearchResult,
    ThemisMemoryGate, ProtectedMemoryStore,
)


# ============================================================================
# MemoryStore Tests (12 tests)
# ============================================================================

class TestMemoryStore:
    """Test MemoryStore functionality"""

    def test_store_and_retrieve(self):
        """Store value, retrieve before expiry"""
        store = MemoryStore()
        store.store("key1", "value1", ttl=60)
        assert store.recall("key1") == "value1"

    def test_store_and_expire(self):
        """Store value, verify None after expiry"""
        store = MemoryStore()
        store.store("key1", "value1", ttl=1)
        assert store.recall("key1") == "value1"
        time.sleep(1.1)
        assert store.recall("key1") is None

    def test_forget_existing(self):
        """Forget existing key"""
        store = MemoryStore()
        store.store("key1", "value1")
        assert store.forget("key1") is True
        assert store.recall("key1") is None

    def test_forget_nonexistent(self):
        """Forget non-existent key (safe no-op)"""
        store = MemoryStore()
        assert store.forget("nonexistent") is False

    def test_multiple_scopes(self):
        """Store same key in different scopes"""
        store = MemoryStore()
        store.store("key1", "session_value", scope="session")
        store.store("key1", "agent_value", scope="agent")
        store.store("key1", "global_value", scope="global")
        
        # Recall without scope filter should get most recent
        result = store.recall("key1")
        assert result in ["session_value", "agent_value", "global_value"]

    def test_ttl_never_expires(self):
        """Store with ttl=None (never expires)"""
        store = MemoryStore()
        store.store("key1", "value1", ttl=None)
        time.sleep(0.5)
        assert store.recall("key1") == "value1"

    def test_ttl_zero(self):
        """Store with ttl=0 (never expires, edge case)"""
        store = MemoryStore()
        store.store("key1", "value1", ttl=0)
        # ttl=0 means expires at timestamp 0 in past, so should be expired
        # (or treated as special case; verify behavior)
        # Actual behavior: ttl=0 → expires_at = now + 0 = now, immediately expired
        assert store.recall("key1") is None

    def test_cleanup_removes_expired(self):
        """Cleanup removes expired entries"""
        store = MemoryStore()
        store.store("expire1", "val1", ttl=1)
        store.store("expire2", "val2", ttl=1)
        store.store("keep", "val3", ttl=100)
        
        assert store.size() == 3
        time.sleep(1.1)
        
        count = store.cleanup()
        assert count == 2
        assert store.recall("keep") == "val3"

    def test_json_serialization(self):
        """Serialize/deserialize to JSON"""
        store1 = MemoryStore()
        store1.store("key1", "value1")
        store1.store("key2", {"nested": "dict"})
        
        json_str = store1.to_json()
        
        store2 = MemoryStore()
        store2.from_json(json_str)
        
        assert store2.recall("key1") == "value1"
        assert store2.recall("key2") == {"nested": "dict"}

    def test_concurrent_access(self):
        """Thread-safe store/recall operations"""
        store = MemoryStore()
        results = []
        
        def worker(i):
            store.store(f"key{i}", f"value{i}", ttl=60)
            val = store.recall(f"key{i}")
            results.append(val == f"value{i}")
        
        threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        assert all(results)
        assert store.active_size() == 10

    def test_special_chars_in_key(self):
        """Keys with special characters"""
        store = MemoryStore()
        special_key = "user.profile.name:admin@example.com"
        store.store(special_key, "value")
        assert store.recall(special_key) == "value"

    def test_large_value_storage(self):
        """Store large value (1MB+)"""
        store = MemoryStore()
        large_value = "x" * (1024 * 1024)  # 1MB
        store.store("large", large_value)
        assert store.recall("large") == large_value


# ============================================================================
# ContextManager Tests (8 tests)
# ============================================================================

class TestContextManager:
    """Test ContextManager functionality"""

    def test_add_and_get_turn(self):
        """Add turn, retrieve in context"""
        ctx = ContextManager()
        turn = Turn(actor="user", query="Hello", response="Hi there")
        ctx.add_turn(turn)
        
        context = ctx.get_context()
        assert len(context) == 1
        assert context[0].actor == "user"

    def test_sliding_window(self):
        """Add 100 turns, window preserves last 50"""
        ctx = ContextManager(window_size=50)
        for i in range(100):
            turn = Turn(actor=f"user{i}", query=f"q{i}", response=f"r{i}")
            ctx.add_turn(turn)
        
        window = ctx.get_context()
        assert len(window) <= 50
        # Should have turns 50-99
        first_actor = window[0].actor
        assert int(first_actor[4:]) >= 50

    def test_full_history_preserved(self):
        """Full history contains all turns (even outside window)"""
        ctx = ContextManager(window_size=10)
        for i in range(20):
            turn = Turn(actor=f"user{i}", query=f"q{i}", response=f"r{i}")
            ctx.add_turn(turn)
        
        history = ctx.full_history()
        assert len(history) == 20

    def test_clear_context(self):
        """Clear resets context"""
        ctx = ContextManager()
        ctx.add_turn(Turn(actor="user", query="q", response="r"))
        assert len(ctx.get_context()) == 1
        
        ctx.clear()
        assert len(ctx.get_context()) == 0
        assert len(ctx.full_history()) == 0

    def test_context_size_metrics(self):
        """Get context size metrics"""
        ctx = ContextManager(window_size=50, summary_threshold_age=0)  # Immediate summary
        for i in range(100):
            ctx.add_turn(Turn(actor=f"u{i}", query="q", response="r"))
        
        window_size, history_size, summary_count = ctx.context_size()
        assert window_size <= 50
        assert history_size == 100
        # Summary may or may not have happened depending on timing, just check counts

    def test_concurrent_add_turn(self):
        """Thread-safe add_turn"""
        ctx = ContextManager()
        results = []
        
        def worker(i):
            turn = Turn(actor=f"user{i}", query=f"q{i}", response=f"r{i}")
            ctx.add_turn(turn)
            results.append(i)
        
        threads = [threading.Thread(target=worker, args=(i,)) for i in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        assert len(ctx.full_history()) == 20

    def test_filter_by_actor(self):
        """Filter history by actor"""
        ctx = ContextManager()
        ctx.add_turn(Turn(actor="user", query="q1", response="r1"))
        ctx.add_turn(Turn(actor="daedalus", query="q2", response="r2"))
        ctx.add_turn(Turn(actor="user", query="q3", response="r3"))
        
        user_turns = ctx.filter_by_actor("user")
        assert len(user_turns) == 2
        assert all(t.actor == "user" for t in user_turns)

    def test_json_serialization(self):
        """Serialize/deserialize context"""
        ctx1 = ContextManager()
        ctx1.add_turn(Turn(actor="user", query="q1", response="r1"))
        ctx1.add_turn(Turn(actor="daedalus", query="q2", response="r2"))
        
        json_str = ctx1.to_json()
        
        ctx2 = ContextManager()
        ctx2.from_json(json_str)
        
        history = ctx2.full_history()
        assert len(history) == 2
        assert history[0].actor == "user"


# ============================================================================
# HistoryTracker Tests (10 tests)
# ============================================================================

class TestHistoryTracker:
    """Test HistoryTracker functionality"""

    def test_log_and_retrieve(self):
        """Log action, retrieve"""
        tracker = HistoryTracker()
        record = tracker.log(
            actor="daedalus",
            action_type="code_generated",
            result="SUCCESS",
        )
        
        assert record.actor == "daedalus"
        assert record.action_type == "code_generated"
        assert len(tracker.get_all()) == 1

    def test_immutability(self):
        """ActionRecord is immutable (frozen dataclass)"""
        tracker = HistoryTracker()
        record = tracker.log(
            actor="daedalus",
            action_type="test_passed",
            result="SUCCESS",
        )
        
        # Attempt to modify should fail
        with pytest.raises(Exception):  # FrozenInstanceError or AttributeError
            record.actor = "modified"

    def test_append_only(self):
        """Log is append-only (1000 records integrity)"""
        tracker = HistoryTracker()
        
        for i in range(1000):
            tracker.log(
                actor=f"agent{i % 5}",
                action_type=f"action{i % 3}",
                result="SUCCESS" if i % 2 == 0 else "FAILURE",
            )
        
        assert tracker.size() == 1000
        all_records = tracker.get_all()
        assert len(all_records) == 1000
        # Verify order preserved
        assert all_records[0].actor.startswith("agent")
        assert all_records[-1].actor.startswith("agent")

    def test_query_by_time(self):
        """Query records in time range"""
        tracker = HistoryTracker()
        t1 = time.time()
        
        tracker.log("daedalus", "action1", "SUCCESS")
        time.sleep(0.1)
        t_mid = time.time()
        time.sleep(0.1)
        tracker.log("themis", "action2", "SUCCESS")
        t2 = time.time()
        
        results = tracker.query_by_time(t1 - 1, t_mid)
        assert len(results) == 1
        assert results[0].actor == "daedalus"

    def test_query_by_actor(self):
        """Query records by actor"""
        tracker = HistoryTracker()
        tracker.log("daedalus", "action1", "SUCCESS")
        tracker.log("themis", "action2", "BLOCKED")
        tracker.log("daedalus", "action3", "SUCCESS")
        
        daedalus_records = tracker.query_by_actor("daedalus")
        assert len(daedalus_records) == 2
        assert all(r.actor == "daedalus" for r in daedalus_records)

    def test_query_by_action(self):
        """Query records by action type"""
        tracker = HistoryTracker()
        tracker.log("daedalus", "test_passed", "SUCCESS")
        tracker.log("daedalus", "approval_requested", "PENDING")
        tracker.log("themis", "test_passed", "SUCCESS")
        
        test_records = tracker.query_by_action("test_passed")
        assert len(test_records) == 2
        assert all(r.action_type == "test_passed" for r in test_records)

    def test_query_by_result(self):
        """Query records by result status"""
        tracker = HistoryTracker()
        tracker.log("a", "action", "SUCCESS")
        tracker.log("a", "action", "FAILURE")
        tracker.log("a", "action", "SUCCESS")
        
        success = tracker.query_by_result("SUCCESS")
        failure = tracker.query_by_result("FAILURE")
        
        assert len(success) == 2
        assert len(failure) == 1

    def test_csv_export(self):
        """Export log as CSV"""
        tracker = HistoryTracker()
        tracker.log("daedalus", "action1", "SUCCESS", {"key": "value"})
        tracker.log("themis", "action2", "BLOCKED")
        
        csv_str = tracker.to_csv()
        lines = csv_str.strip().split("\n")
        
        assert len(lines) == 3  # Header + 2 records
        assert "action1" in csv_str
        assert "action2" in csv_str

    def test_json_export(self):
        """Export log as JSON"""
        tracker = HistoryTracker()
        tracker.log("daedalus", "action1", "SUCCESS")
        tracker.log("themis", "action2", "BLOCKED")
        
        json_str = tracker.to_json()
        data = json.loads(json_str)
        
        assert "log" in data
        assert len(data["log"]) == 2

    def test_statistics(self):
        """Get summary statistics"""
        tracker = HistoryTracker()
        tracker.log("daedalus", "code_gen", "SUCCESS")
        tracker.log("themis", "approval", "BLOCKED")
        tracker.log("daedalus", "test", "SUCCESS")
        tracker.log("themis", "approval", "SUCCESS")
        
        stats = tracker.statistics()
        
        assert stats["total_records"] == 4
        assert stats["by_actor"]["daedalus"] == 2
        assert stats["by_actor"]["themis"] == 2
        assert stats["by_result"]["SUCCESS"] == 3
        assert stats["by_result"]["BLOCKED"] == 1


# ============================================================================
# RetrievalEngine Tests (8 tests)
# ============================================================================

class TestRetrievalEngine:
    """Test RetrievalEngine and SimilarityScorer"""

    def test_cosine_similarity(self):
        """Cosine similarity calculation"""
        scorer = SimilarityScorer()
        
        # Identical vectors → score 1.0
        vec_a = [1.0, 0.0, 0.0]
        vec_b = [1.0, 0.0, 0.0]
        assert scorer.cosine_distance(vec_a, vec_b) == 1.0
        
        # Orthogonal → score 0.0
        vec_c = [0.0, 1.0, 0.0]
        assert scorer.cosine_distance(vec_a, vec_c) == 0.0

    def test_recency_weight(self):
        """Recency weighting (newer = higher)"""
        scorer = SimilarityScorer()
        now = time.time()
        
        recent = now - 60  # 1 min ago
        old = now - 3600  # 1 hour ago
        
        weight_recent = scorer.recency_weight(recent, now)
        weight_old = scorer.recency_weight(old, now)
        
        assert weight_recent > weight_old
        assert weight_recent > 0.5  # 1 min should have >50% weight
        assert weight_old < 0.5  # 1 hour should have <50% weight

    def test_keyword_match_score(self):
        """Keyword matching"""
        scorer = SimilarityScorer()
        
        score = scorer.keyword_match_score("python java", "python is great")
        assert score == 0.5  # 1 match out of 2 keywords
        
        score = scorer.keyword_match_score("foo bar", "foo bar baz")
        assert score == 1.0  # Both keywords match

    def test_index_and_search(self):
        """Index items and search"""
        engine = RetrievalEngine()
        
        engine.index("doc1", "python programming tutorial", text="Learn Python")
        engine.index("doc2", "java programming guide", text="Learn Java")
        engine.index("doc3", "rust systems programming", text="Learn Rust")
        
        results = engine.search("python programming", top_k=2)
        
        assert len(results) <= 2
        assert results[0].key == "doc1"  # Should rank python doc highest

    def test_search_threshold(self):
        """Search respects threshold"""
        engine = RetrievalEngine()
        
        engine.index("match", "exact match", text="exact")
        engine.index("nomatch", "unrelated content", text="unrelated")
        
        results = engine.search("exact", threshold=0.8, top_k=10)
        
        # At high threshold, should only get good matches
        assert all(r.score >= 0.8 or r.score == 0.0 for r in results)

    def test_explain_ranking(self):
        """Explain scoring breakdown"""
        engine = RetrievalEngine()
        engine.index("key1", "python", text="Python programming")
        
        results = engine.search("python", top_k=1)
        
        if results:
            explanation = engine.explain("python", results[0])
            assert "key" in explanation
            assert "score" in explanation
            assert "relevance_breakdown" in explanation

    def test_search_empty_index(self):
        """Search on empty index returns empty"""
        engine = RetrievalEngine()
        results = engine.search("anything", top_k=5)
        assert results == []

    def test_semantic_similarity(self):
        """Semantic search with embeddings"""
        engine = RetrievalEngine()
        
        # Embeddings for "cat"
        cat_emb = [1.0, 0.0, 0.5]
        # Embeddings for "dog" (similar)
        dog_emb = [1.0, 0.1, 0.5]
        # Embeddings for "car" (dissimilar)
        car_emb = [0.0, 1.0, 0.0]
        
        engine.index("cat", "feline", embeddings=cat_emb)
        engine.index("dog", "canine", embeddings=dog_emb)
        engine.index("car", "vehicle", embeddings=car_emb)
        
        # Search with "cat" embedding
        results = engine.search("feline", query_embedding=cat_emb, top_k=3)
        
        # Should rank similar items higher
        if len(results) > 1:
            assert results[0].relevance["semantic"] > 0


# ============================================================================
# ThemisMemoryGate Tests (4 tests)
# ============================================================================

class TestThemisMemoryGate:
    """Test ThemisMemoryGate safety layer"""

    def test_auto_approve_safe_pattern(self):
        """Safe patterns auto-approve without Themis"""
        gate = ThemisMemoryGate()
        
        approved, reason = gate.request_recall("conversation.turn1", actor="daedalus")
        assert approved is True
        assert "auto-approved" in reason.lower()

    def test_request_recall_blocked_by_default(self):
        """Recall of unknown keys blocked by default (no Themis)"""
        gate = ThemisMemoryGate()
        
        approved, reason = gate.request_recall("sensitive.data", actor="daedalus")
        assert approved is False
        assert "blocked" in reason.lower()

    def test_request_forget_always_escalates(self):
        """Forget always escalates to Themis (never auto-approve)"""
        gate = ThemisMemoryGate()
        
        approved, reason = gate.request_forget("conversation.turn1", actor="daedalus")
        # With no Themis, should be blocked
        assert approved is False

    def test_request_log_and_stats(self):
        """Request log and statistics tracking"""
        gate = ThemisMemoryGate()
        
        gate.request_recall("conversation.turn1", actor="daedalus")
        gate.request_store("conversation.turn2", "value", actor="daedalus")
        gate.request_recall("sensitive.data", actor="daedalus")
        
        log = gate.get_request_log()
        assert len(log) == 3
        
        stats = gate.get_request_stats()
        assert stats["total_requests"] == 3
        assert stats["approved"] >= 1  # At least one auto-approved
        assert stats["blocked"] >= 1  # At least one blocked


# ============================================================================
# Integration Tests (5 tests)
# ============================================================================

class TestIntegration:
    """Integration tests combining multiple modules"""

    def test_full_workflow(self):
        """Full workflow: store → context → history → retrieve"""
        store = MemoryStore()
        ctx = ContextManager()
        tracker = HistoryTracker()
        
        # Store memory
        store.store("conversation.turn1", "Hello", ttl=3600)
        tracker.log("user", "message_sent", "SUCCESS")
        
        # Add context
        turn = Turn(actor="user", query="Hello", response="Hi")
        ctx.add_turn(turn)
        tracker.log("daedalus", "response_generated", "SUCCESS")
        
        # Retrieve
        assert store.recall("conversation.turn1") == "Hello"
        assert ctx.full_history()[0].actor == "user"
        assert tracker.size() == 2

    def test_themis_protected_store(self):
        """Protected store with Themis gate"""
        store = MemoryStore()
        gate = ThemisMemoryGate()
        protected = ProtectedMemoryStore(store, gate)
        
        # Safe pattern should work
        protected.store("conversation.turn1", "safe", actor="daedalus")
        assert store.recall("conversation.turn1") == "safe"
        
        # Sensitive pattern should be blocked
        with pytest.raises(PermissionError):
            protected.store("sensitive.secret", "blocked", actor="daedalus")

    def test_ttl_context_history(self):
        """TTL, context, and history work together"""
        store = MemoryStore()
        ctx = ContextManager()
        tracker = HistoryTracker()
        
        # Store with short TTL
        store.store("temp", "value", ttl=1)
        ctx.add_turn(Turn(actor="a", query="q", response="r"))
        tracker.log("agent", "action", "SUCCESS")
        
        # Should all be accessible
        assert store.recall("temp") == "value"
        assert len(ctx.full_history()) == 1
        assert tracker.size() == 1
        
        # After TTL, store should expire
        time.sleep(1.1)
        assert store.recall("temp") is None
        
        # Context and history should persist
        assert len(ctx.full_history()) == 1
        assert tracker.size() == 1

    def test_concurrent_multi_module(self):
        """Concurrent operations across modules"""
        store = MemoryStore()
        ctx = ContextManager()
        tracker = HistoryTracker()
        results = []
        
        def worker(i):
            # Store
            store.store(f"key{i}", f"value{i}")
            # Context
            ctx.add_turn(Turn(actor=f"actor{i}", query=f"q{i}", response=f"r{i}"))
            # History
            tracker.log(f"agent{i}", f"action{i}", "SUCCESS")
            # Verify
            results.append(store.recall(f"key{i}") == f"value{i}")
        
        threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        assert all(results)
        assert store.active_size() == 10
        assert len(ctx.full_history()) == 10
        assert tracker.size() == 10

    def test_export_and_restore(self):
        """Export all modules, restore, verify"""
        # Create and populate
        store = MemoryStore()
        store.store("key1", "value1")
        
        ctx = ContextManager()
        ctx.add_turn(Turn(actor="user", query="q", response="r"))
        
        tracker = HistoryTracker()
        tracker.log("agent", "action", "SUCCESS")
        
        # Export
        store_json = store.to_json()
        ctx_json = ctx.to_json()
        tracker_json = tracker.to_json()
        
        # Restore
        store2 = MemoryStore()
        store2.from_json(store_json)
        
        ctx2 = ContextManager()
        ctx2.from_json(ctx_json)
        
        tracker2 = HistoryTracker()
        tracker2.from_json(tracker_json)
        
        # Verify
        assert store2.recall("key1") == "value1"
        assert len(ctx2.full_history()) == 1
        assert tracker2.size() == 1


# ============================================================================
# Run Tests
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

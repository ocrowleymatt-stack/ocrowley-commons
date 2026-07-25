"""
ocrowley_memory (from Life-os Morpheus) (D-07 Morpheus)

Provides complete memory system:
- MemoryStore: TTL-based key-value storage
- ContextManager: Multi-turn conversation tracking
- HistoryTracker: Immutable audit log
- RetrievalEngine: Semantic search + ranking
- ThemisMemoryGate: Safety approval layer

Status: Phase 2, Issue #8
"""

from .memory_store import MemoryEntry, MemoryStore
from .context_manager import Turn, SummaryTurn, ContextManager
from .history_tracker import ActionRecord, HistoryTracker
from .retrieval import SimilarityScorer, SearchResult, RetrievalEngine
from .integration import ThemisMemoryGate, MemoryRequest, ProtectedMemoryStore

__version__ = "1.0"
__status__ = "Phase 2 (Morpheus)"

__all__ = [
    # Memory store
    "MemoryEntry",
    "MemoryStore",
    # Context management
    "Turn",
    "SummaryTurn",
    "ContextManager",
    # History tracking
    "ActionRecord",
    "HistoryTracker",
    # Retrieval
    "SimilarityScorer",
    "SearchResult",
    "RetrievalEngine",
    # Integration
    "ThemisMemoryGate",
    "MemoryRequest",
    "ProtectedMemoryStore",
]

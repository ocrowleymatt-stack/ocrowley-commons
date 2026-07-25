"""
Context Manager — Multi-turn conversation state tracking for Daedalus

Provides:
- Sliding window of recent conversation turns
- Automatic summarization of old turns
- Full history preservation
- Thread-safe operations

Status: D-07 Morpheus Phase 2
"""

import json
import time
import threading
from dataclasses import dataclass, asdict, field
from typing import Any, Optional, List, Dict
from collections import deque


@dataclass
class Turn:
    """Single conversation turn"""
    timestamp: float = field(default_factory=time.time)
    actor: str = ""  # e.g., "user", "Daedalus", "Themis"
    query: str = ""  # Input/request
    response: str = ""  # Output/result
    metadata: Dict[str, Any] = field(default_factory=dict)  # Tags, action_id, etc.

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dict"""
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Turn":
        """Deserialize from dict"""
        return cls(**d)


@dataclass
class SummaryTurn:
    """Compressed summary of multiple old turns"""
    timestamp: float = field(default_factory=time.time)
    actor: str = "system"
    query: str = "[SUMMARY]"
    response: str = ""  # Contains summarized content
    turn_count: int = 0  # Number of turns summarized
    time_span: tuple = (0.0, 0.0)  # (start_time, end_time)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dict"""
        return asdict(self)


class ContextManager:
    """Multi-turn conversation context with sliding window + summarization"""

    def __init__(self, window_size: int = 50, summary_threshold_age: int = 1800):
        """
        Initialize context manager.

        Args:
            window_size: Max number of recent turns to keep (default 50)
            summary_threshold_age: Age in seconds before old turns are summarized (default 30 min)
        """
        self._turns: deque = deque(maxlen=window_size)
        self._full_history: List[Turn] = []
        self._summaries: List[SummaryTurn] = []
        self._lock = threading.RLock()
        self._window_size = window_size
        self._summary_threshold = summary_threshold_age
        self._last_summary = time.time()

    def add_turn(self, turn: Turn) -> None:
        """
        Add a new turn to context.

        Args:
            turn: Turn object to add
        """
        with self._lock:
            self._turns.append(turn)
            self._full_history.append(turn)
            self._maybe_summarize_old_turns()

    def add_turn_from_dict(self, d: Dict[str, Any]) -> None:
        """Create turn from dict and add"""
        turn = Turn.from_dict(d)
        self.add_turn(turn)

    def get_context(self, n_turns: Optional[int] = None) -> List[Turn]:
        """
        Get last N turns (sliding window).

        Args:
            n_turns: Number of turns (None = all in window)

        Returns:
            List of turns (oldest to newest)
        """
        with self._lock:
            if n_turns is None:
                return list(self._turns)
            return list(self._turns)[-n_turns:] if len(self._turns) > 0 else []

    def full_history(self) -> List[Turn]:
        """Get entire history of turns (immutable copy)"""
        with self._lock:
            return list(self._full_history)

    def get_summaries(self) -> List[SummaryTurn]:
        """Get all summaries of compressed old turns"""
        with self._lock:
            return list(self._summaries)

    def _maybe_summarize_old_turns(self) -> None:
        """
        Summarize turns older than threshold (must be called with lock held).
        Keeps them in history but compresses for context efficiency.
        """
        now = time.time()
        if now - self._last_summary < self._summary_threshold:
            return  # Only summarize periodically

        old_turns = [
            t for t in self._full_history
            if (now - t.timestamp) > self._summary_threshold
        ]

        if not old_turns:
            self._last_summary = now
            return

        # Create summary
        summary_text = f"Summarized {len(old_turns)} turns:\n"
        for turn in old_turns[:5]:  # Sample first 5
            summary_text += f"  - {turn.actor}: {turn.query[:50]}...\n"
        if len(old_turns) > 5:
            summary_text += f"  ... and {len(old_turns) - 5} more\n"

        summary = SummaryTurn(
            response=summary_text,
            turn_count=len(old_turns),
            time_span=(old_turns[0].timestamp, old_turns[-1].timestamp),
        )
        self._summaries.append(summary)
        self._last_summary = now

    def clear(self) -> None:
        """Clear all context (reset for new conversation)"""
        with self._lock:
            self._turns.clear()
            self._full_history.clear()
            self._summaries.clear()
            self._last_summary = time.time()

    def to_dict(self) -> Dict[str, Any]:
        """Serialize context to dict"""
        with self._lock:
            return {
                "window": [t.to_dict() for t in self._turns],
                "history": [t.to_dict() for t in self._full_history],
                "summaries": [s.to_dict() for s in self._summaries],
            }

    def to_json(self) -> str:
        """Serialize context to JSON"""
        return json.dumps(self.to_dict())

    def from_json(self, json_str: str) -> None:
        """Restore context from JSON"""
        data = json.loads(json_str)
        with self._lock:
            self._turns.clear()
            for t_dict in data.get("window", []):
                self._turns.append(Turn.from_dict(t_dict))
            self._full_history = [Turn.from_dict(t) for t in data.get("history", [])]
            self._summaries = [SummaryTurn(**s) for s in data.get("summaries", [])]

    def context_size(self) -> tuple:
        """
        Get size metrics.

        Returns:
            (current_window_size, total_history_size, summary_count)
        """
        with self._lock:
            return (len(self._turns), len(self._full_history), len(self._summaries))

    def get_recent_actors(self) -> List[str]:
        """Get list of actors in recent context (no duplicates, preserve order)"""
        with self._lock:
            seen = set()
            actors = []
            for turn in reversed(self._turns):
                if turn.actor not in seen:
                    actors.append(turn.actor)
                    seen.add(turn.actor)
            return list(reversed(actors))

    def filter_by_actor(self, actor: str) -> List[Turn]:
        """Get all turns by a specific actor"""
        with self._lock:
            return [t for t in self._full_history if t.actor == actor]


__all__ = ["Turn", "SummaryTurn", "ContextManager"]

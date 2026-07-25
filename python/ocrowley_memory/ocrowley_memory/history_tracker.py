"""
History Tracker — Immutable append-only audit log for Daedalus

Provides:
- Immutable action records (cannot be modified after creation)
- Append-only log (writes are serialized)
- Query by time range, actor, or action type
- CSV/JSON export

Status: D-07 Morpheus Phase 2
"""

import json
import time
import threading
import csv
from dataclasses import dataclass, asdict, field
from typing import Any, Optional, List, Dict, Literal
from io import StringIO


@dataclass(frozen=True)
class ActionRecord:
    """
    Immutable record of a single action/decision.
    frozen=True makes this hashable and immutable.
    """
    timestamp: float = field(default_factory=time.time)
    actor: str = ""  # e.g., "Daedalus", "Themis", "Aegis"
    action_type: str = ""  # e.g., "code_generated", "test_passed", "approval_requested"
    result: Literal["SUCCESS", "FAILURE", "BLOCKED", "PENDING"] = "PENDING"
    metadata: Dict[str, Any] = field(default_factory=dict)  # Extra details

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict (for JSON)"""
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ActionRecord":
        """Reconstruct from dict"""
        return cls(**d)


class HistoryTracker:
    """Immutable append-only history log"""

    def __init__(self):
        """Initialize tracker with empty log"""
        self._log: List[ActionRecord] = []
        self._lock = threading.Lock()  # Write-only lock (readers don't block)

    def log(
        self,
        actor: str,
        action_type: str,
        result: Literal["SUCCESS", "FAILURE", "BLOCKED", "PENDING"] = "SUCCESS",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ActionRecord:
        """
        Log an action (append-only).

        Args:
            actor: Agent/component performing action
            action_type: Type of action
            result: Outcome (SUCCESS, FAILURE, BLOCKED, PENDING)
            metadata: Optional extra details

        Returns:
            The created ActionRecord (for confirmation)
        """
        record = ActionRecord(
            actor=actor,
            action_type=action_type,
            result=result,
            metadata=metadata or {},
        )

        with self._lock:
            self._log.append(record)

        return record

    def get_all(self) -> List[ActionRecord]:
        """
        Get entire log (safe read without lock).

        Returns:
            List of ActionRecord (immutable, so safe to share)
        """
        return list(self._log)  # Snapshot is safe since records are immutable

    def query_by_time(
        self,
        start: float,
        end: Optional[float] = None,
    ) -> List[ActionRecord]:
        """
        Get records within time range.

        Args:
            start: Start timestamp (inclusive)
            end: End timestamp (inclusive, defaults to now)

        Returns:
            Filtered list of ActionRecord
        """
        end = end or time.time()
        return [r for r in self._log if start <= r.timestamp <= end]

    def query_by_actor(self, actor: str) -> List[ActionRecord]:
        """Get all records by a specific actor"""
        return [r for r in self._log if r.actor == actor]

    def query_by_action(self, action_type: str) -> List[ActionRecord]:
        """Get all records of a specific action type"""
        return [r for r in self._log if r.action_type == action_type]

    def query_by_result(
        self,
        result: Literal["SUCCESS", "FAILURE", "BLOCKED", "PENDING"],
    ) -> List[ActionRecord]:
        """Get all records with specific result"""
        return [r for r in self._log if r.result == result]

    def size(self) -> int:
        """Total number of records"""
        return len(self._log)

    def to_dict(self) -> Dict[str, List[Dict[str, Any]]]:
        """Serialize log to dict"""
        return {"log": [r.to_dict() for r in self._log]}

    def to_json(self) -> str:
        """Serialize log to JSON"""
        return json.dumps(self.to_dict(), default=str)

    def from_json(self, json_str: str) -> None:
        """
        Restore log from JSON (CAUTION: replaces existing log).

        Args:
            json_str: JSON string from to_json()
        """
        data = json.loads(json_str)
        with self._lock:
            self._log = [ActionRecord.from_dict(r) for r in data.get("log", [])]

    def to_csv(self) -> str:
        """
        Export log as CSV.

        Returns:
            CSV string (columns: timestamp, actor, action_type, result, metadata_json)
        """
        output = StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=["timestamp", "actor", "action_type", "result", "metadata"],
        )
        writer.writeheader()
        for record in self._log:
            writer.writerow({
                "timestamp": record.timestamp,
                "actor": record.actor,
                "action_type": record.action_type,
                "result": record.result,
                "metadata": json.dumps(record.metadata),
            })
        return output.getvalue()

    def export(self, format: Literal["json", "csv", "dict"] = "json") -> str:
        """
        Export log in specified format.

        Args:
            format: "json", "csv", or "dict" (dict returns JSON-serialized dict)

        Returns:
            Serialized log
        """
        if format == "csv":
            return self.to_csv()
        elif format == "dict":
            return json.dumps(self.to_dict(), default=str)
        else:  # json
            return self.to_json()

    def clear(self) -> None:
        """Clear all records (rarely used, but supported)"""
        with self._lock:
            self._log.clear()

    def statistics(self) -> Dict[str, Any]:
        """
        Get summary statistics about the log.

        Returns:
            Dict with counts by actor, action_type, result
        """
        actors = {}
        actions = {}
        results = {}

        for record in self._log:
            actors[record.actor] = actors.get(record.actor, 0) + 1
            actions[record.action_type] = actions.get(record.action_type, 0) + 1
            results[record.result] = results.get(record.result, 0) + 1

        return {
            "total_records": len(self._log),
            "by_actor": actors,
            "by_action_type": actions,
            "by_result": results,
        }


__all__ = ["ActionRecord", "HistoryTracker"]

"""Personal search planner heuristics (from Life search_planner.py, FastAPI/DB removed)."""
from __future__ import annotations

VALID_QUERY_TYPES = {
    "general", "person", "project", "concept", "event", "decision", "organisation"
}

VALID_SOURCES = {
    "memory_graph", "timeline", "documents", "projects", "people", "web"
}

SOURCE_DEFAULTS: dict[str, list[str]] = {
    "general": ["memory_graph", "timeline", "documents", "projects", "people", "web"],
    "person": ["people", "memory_graph", "timeline", "documents"],
    "project": ["projects", "documents", "people", "timeline"],
    "concept": ["documents", "memory_graph", "web"],
    "event": ["timeline", "documents", "people"],
    "decision": ["documents", "projects", "timeline"],
    "organisation": ["people", "documents", "memory_graph", "web"],
}


def plan_sources(query_type: str = "general", sources_override: list[str] | None = None) -> list[str]:
    """Return ordered sources for a query type. Override must be subset of VALID_SOURCES."""
    if sources_override:
        return [s for s in sources_override if s in VALID_SOURCES]
    qt = query_type if query_type in VALID_QUERY_TYPES else "general"
    return list(SOURCE_DEFAULTS[qt])

"""
Retrieval Engine — Semantic search + ranking for memory recall

Provides:
- Cosine similarity for vector matching
- Recency weighting (newer results ranked higher)
- Keyword matching
- Ranked search with configurable threshold

Status: D-07 Morpheus Phase 2
"""

import time
import math
from dataclasses import dataclass, field
from typing import Any, List, Dict, Optional, Tuple
from collections import defaultdict


@dataclass
class SearchResult:
    """Single search result with score"""
    key: str
    value: Any
    score: float
    relevance: Dict[str, float] = field(default_factory=dict)  # Breakdown of scoring

    def __lt__(self, other: "SearchResult") -> bool:
        """For sorting (higher score = better)"""
        return self.score > other.score


class SimilarityScorer:
    """Compute similarity scores between queries and indexed items"""

    @staticmethod
    def cosine_distance(vec_a: List[float], vec_b: List[float]) -> float:
        """
        Compute cosine similarity between two vectors.

        Args:
            vec_a, vec_b: Embedding vectors (same length)

        Returns:
            Similarity score in [0, 1]
        """
        if len(vec_a) == 0 or len(vec_b) == 0:
            return 0.0

        dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
        mag_a = math.sqrt(sum(a * a for a in vec_a))
        mag_b = math.sqrt(sum(b * b for b in vec_b))

        if mag_a == 0 or mag_b == 0:
            return 0.0

        return dot_product / (mag_a * mag_b)

    @staticmethod
    def recency_weight(timestamp: float, now: Optional[float] = None) -> float:
        """
        Weight score based on recency (exponential decay).

        Args:
            timestamp: Creation/update time
            now: Current time (defaults to now)

        Returns:
            Weight in (0, 1] where 1.0 = very recent, 0.5 = 1 hour old
        """
        now = now or time.time()
        age_minutes = (now - timestamp) / 60.0
        # Decay: exp(-age/60) means 1hr old = 0.5 weight
        weight = math.exp(-age_minutes / 60.0)
        return max(weight, 0.01)  # Never go below 0.01

    @staticmethod
    def keyword_match_score(query: str, text: str) -> float:
        """
        Simple keyword matching score.

        Args:
            query: Search query
            text: Text to match against

        Returns:
            Score in [0, 1] (# matching keywords / # query keywords)
        """
        query_words = set(query.lower().split())
        text_words = set(text.lower().split())

        if not query_words:
            return 0.0

        matches = len(query_words & text_words)
        return matches / len(query_words)

    @staticmethod
    def relevance_score(
        query_embedding: Optional[List[float]],
        text_embedding: Optional[List[float]],
        query_text: str,
        item_text: str,
        timestamp: float,
        semantic_weight: float = 0.7,
        keyword_weight: float = 0.2,
        recency_weight_param: float = 0.1,
    ) -> Tuple[float, Dict[str, float]]:
        """
        Compute combined relevance score.

        Args:
            query_embedding: Query vector (or None)
            text_embedding: Item vector (or None)
            query_text: Query text
            item_text: Item text
            timestamp: Item creation time
            semantic_weight: Weight for semantic similarity
            keyword_weight: Weight for keyword matching
            recency_weight_param: Weight for recency

        Returns:
            (total_score, breakdown_dict)
        """
        scores = {}

        # Semantic similarity
        semantic = 0.0
        if query_embedding and text_embedding:
            semantic = SimilarityScorer.cosine_distance(query_embedding, text_embedding)
        scores["semantic"] = semantic

        # Keyword match
        keyword = SimilarityScorer.keyword_match_score(query_text, item_text)
        scores["keyword"] = keyword

        # Recency
        recency = SimilarityScorer.recency_weight(timestamp)
        scores["recency"] = recency

        # Weighted total
        total = (
            semantic * semantic_weight +
            keyword * keyword_weight +
            recency * recency_weight_param
        )

        return total, scores


class RetrievalEngine:
    """Index and search memory items"""

    def __init__(self):
        """Initialize empty index"""
        self._index: Dict[str, Dict[str, Any]] = {}
        self._embeddings: Dict[str, List[float]] = {}
        self._timestamps: Dict[str, float] = {}

    def index(
        self,
        key: str,
        value: Any,
        embeddings: Optional[List[float]] = None,
        text: Optional[str] = None,
    ) -> None:
        """
        Add item to search index.

        Args:
            key: Item key
            value: Item value (stored for retrieval)
            embeddings: Optional embedding vector
            text: Optional text representation (for keyword search)
        """
        self._index[key] = {
            "value": value,
            "text": text or str(value)[:500],  # Limit text size
        }
        if embeddings:
            self._embeddings[key] = embeddings
        self._timestamps[key] = time.time()

    def search(
        self,
        query_text: str,
        query_embedding: Optional[List[float]] = None,
        top_k: int = 5,
        threshold: float = 0.0,
    ) -> List[SearchResult]:
        """
        Search index for relevant items.

        Args:
            query_text: Query text (for keyword matching)
            query_embedding: Optional query embedding (for semantic search)
            top_k: Number of top results to return
            threshold: Minimum score threshold (default 0, include all)

        Returns:
            List of SearchResult (sorted by score, highest first)
        """
        results = []

        for key in self._index:
            item = self._index[key]
            item_embedding = self._embeddings.get(key)
            timestamp = self._timestamps.get(key, time.time())

            score, breakdown = SimilarityScorer.relevance_score(
                query_embedding=query_embedding,
                text_embedding=item_embedding,
                query_text=query_text,
                item_text=item["text"],
                timestamp=timestamp,
            )

            if score >= threshold:
                results.append(SearchResult(
                    key=key,
                    value=item["value"],
                    score=score,
                    relevance=breakdown,
                ))

        # Sort by score (descending)
        results.sort()
        return results[:top_k]

    def explain(self, query_text: str, result: SearchResult) -> Dict[str, Any]:
        """
        Explain why an item was ranked (for debugging).

        Args:
            query_text: Original query
            result: Search result

        Returns:
            Dict with query, key, score, and scoring breakdown
        """
        return {
            "query": query_text,
            "key": result.key,
            "score": result.score,
            "relevance_breakdown": result.relevance,
        }

    def clear(self) -> None:
        """Clear all indexed items"""
        self._index.clear()
        self._embeddings.clear()
        self._timestamps.clear()

    def size(self) -> int:
        """Number of indexed items"""
        return len(self._index)

    def get(self, key: str) -> Optional[Any]:
        """Get item by key"""
        item = self._index.get(key)
        return item["value"] if item else None


__all__ = ["SimilarityScorer", "SearchResult", "RetrievalEngine"]

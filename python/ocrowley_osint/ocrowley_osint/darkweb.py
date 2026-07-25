"""Clearnet dark-web index helpers (no Tor client)."""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class DarkWebMention:
    title: str
    url: str
    description: str
    source: str = "Ahmia (Tor search index)"


_BLOCK_RE = re.compile(r'<li class="result"[^>]*>[\s\S]*?</li>', re.I)
_TITLE_RE = re.compile(r"<h4[^>]*><a[^>]*>([^<]+)</a>", re.I)
_ONION_RE = re.compile(r'href="([^"]+\.onion[^"]*)"', re.I)
_DESC_RE = re.compile(r'<p[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)</p>', re.I)


def parse_ahmia_html(html: str, limit: int = 10) -> list[DarkWebMention]:
    mentions: list[DarkWebMention] = []
    for block in _BLOCK_RE.findall(html)[:limit]:
        title_m = _TITLE_RE.search(block)
        if not title_m:
            continue
        onion_m = _ONION_RE.search(block)
        desc_m = _DESC_RE.search(block)
        onion = onion_m.group(1) if onion_m else ""
        mentions.append(
            DarkWebMention(
                title=title_m.group(1).strip(),
                url=onion,
                description=desc_m.group(1).strip() if desc_m else "",
            )
        )
    return mentions


def risk_band(total_mentions: int) -> str:
    if total_mentions <= 0:
        return "none"
    if total_mentions <= 1:
        return "low"
    if total_mentions <= 3:
        return "medium"
    return "high"

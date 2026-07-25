"""OSINT module registry and scan contracts."""

from .registry import ModuleResult, OsintModule, OsintRegistry, ScanRequest, ScanType
from .policy import OsintAuth, assert_osint_allowed, evaluate_osint_auth
from .darkweb import DarkWebMention, parse_ahmia_html, risk_band

__all__ = [
    "ModuleResult",
    "OsintModule",
    "OsintRegistry",
    "ScanRequest",
    "ScanType",
    "OsintAuth",
    "assert_osint_allowed",
    "evaluate_osint_auth",
    "DarkWebMention",
    "parse_ahmia_html",
    "risk_band",
]

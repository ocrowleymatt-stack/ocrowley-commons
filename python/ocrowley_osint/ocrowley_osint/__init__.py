"""OSINT module registry and scan contracts."""

from .registry import ModuleResult, OsintModule, OsintRegistry, ScanRequest, ScanType
from .policy import OsintAuth, assert_osint_allowed, evaluate_osint_auth
from .darkweb import DarkWebMention, parse_ahmia_html, risk_band
from .bigbrother import (
    BIG_BROTHER_MODULES,
    bigbrother_available,
    create_bigbrother_registry,
    register_bigbrother_modules,
)
from .bridge import run_bridge_scan

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
    "BIG_BROTHER_MODULES",
    "bigbrother_available",
    "create_bigbrother_registry",
    "register_bigbrother_modules",
    "run_bridge_scan",
]

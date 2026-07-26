"""TheBigBrother module adapters — available when `the_big_brother` is installed."""

from __future__ import annotations

import importlib
import inspect
from dataclasses import dataclass
from typing import Any, Callable

from .registry import ModuleResult, OsintRegistry, ScanRequest

# All upstream module files under the_big_brother/modules/
BIG_BROTHER_MODULES: tuple[tuple[str, str, bool], ...] = (
    ("bb-phantom-id", "phantom_id", True),
    ("bb-digital-footprint", "digital_footprint", True),
    ("bb-dark-watch", "dark_watch", True),
    ("bb-breach-vault", "breach_vault", True),
    ("bb-wayback-spectre", "wayback_spectre", True),
    ("bb-domain-oracle", "domain_oracle", True),
    ("bb-ssl-sentinel", "ssl_sentinel", True),
    ("bb-network-mapper", "network_mapper", False),
    ("bb-geoint-spy", "geoint_spy", True),
    ("bb-exif-analyzer", "exif_analyzer", True),
    ("bb-crypto-analyzer", "crypto_analyzer", True),
    ("bb-mail-tracer", "mail_tracer", True),
    ("bb-paste-dragnet", "paste_dragnet", True),
    ("bb-dork-studio", "dork_studio", True),
    ("bb-code-hunter", "code_hunter", True),
    ("bb-shadow-map", "shadow_map", True),
    ("bb-sigint-sweep", "sigint_sweep", False),
    ("bb-flight-radar", "flight_radar", True),
    ("bb-ai-analyst", "ai_analyst", True),
)


def bigbrother_available() -> bool:
    try:
        importlib.import_module("the_big_brother")
        return True
    except ImportError:
        return False


def _call_best_effort(module: Any, target: str) -> list[dict[str, Any]]:
    """Invoke the most plausible public callable with the target string."""
    findings: list[dict[str, Any]] = []
    candidates: list[Callable[..., Any]] = []
    for name, obj in inspect.getmembers(module):
        if name.startswith("_"):
            continue
        if inspect.isfunction(obj) or inspect.iscoroutinefunction(obj):
            candidates.append(obj)

    for fn in candidates[:8]:
        try:
            sig = inspect.signature(fn)
            params = [
                p
                for p in sig.parameters.values()
                if p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD)
            ]
            if len(params) == 0:
                continue
            # Prefer sync one-arg callables
            if inspect.iscoroutinefunction(fn):
                continue
            if len(params) == 1:
                result = fn(target)
            elif len(params) >= 1:
                result = fn(target)
            else:
                continue
            findings.append({"function": fn.__name__, "result": result})
            break
        except Exception as exc:  # noqa: BLE001
            findings.append({"function": getattr(fn, "__name__", "?"), "error": str(exc)})
    return findings


@dataclass
class BigBrotherModule:
    id: str
    module_name: str
    passive: bool

    def run(self, request: ScanRequest) -> ModuleResult:
        if not request.authorization_ref.strip():
            return ModuleResult(
                module_id=self.id,
                ok=False,
                summary="authorization_required",
                error="authorization_required",
            )
        try:
            mod = importlib.import_module(f"the_big_brother.modules.{self.module_name}")
        except ImportError as exc:
            return ModuleResult(
                module_id=self.id,
                ok=False,
                summary="the_big_brother not installed",
                error=f"unavailable:{exc}",
            )
        findings = _call_best_effort(mod, request.target)
        ok = any("result" in f for f in findings)
        return ModuleResult(
            module_id=self.id,
            ok=ok,
            summary=f"bigbrother.{self.module_name} {'ran' if ok else 'no compatible entrypoint'}",
            findings=findings,
            error=None if ok else "no_compatible_entrypoint",
        )


def register_bigbrother_modules(registry: OsintRegistry) -> list[str]:
    """Register all BigBrother modules on a registry. Returns registered ids."""
    registered: list[str] = []
    for mid, mod_name, passive in BIG_BROTHER_MODULES:
        registry.register(BigBrotherModule(id=mid, module_name=mod_name, passive=passive))
        registered.append(mid)
    return registered


def create_bigbrother_registry() -> OsintRegistry:
    reg = OsintRegistry()
    register_bigbrother_modules(reg)
    return reg

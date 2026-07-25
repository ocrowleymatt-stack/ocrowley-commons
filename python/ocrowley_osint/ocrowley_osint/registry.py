from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Protocol


class ScanType(str, Enum):
    ALL = "All"
    FOOTPRINT = "Footprint"
    INVESTIGATE = "Investigate"
    PASSIVE = "Passive"


PASSIVE_SAFE_TYPES = {ScanType.PASSIVE, ScanType.FOOTPRINT}


@dataclass(frozen=True)
class ScanRequest:
    target: str
    scan_type: ScanType = ScanType.PASSIVE
    authorization_ref: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ModuleResult:
    module_id: str
    ok: bool
    summary: str
    findings: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None


class OsintModule(Protocol):
    id: str
    passive: bool

    def run(self, request: ScanRequest) -> ModuleResult: ...


class OsintRegistry:
    """Register host-provided OSINT adapters; filter by scan type."""

    def __init__(self) -> None:
        self._modules: dict[str, OsintModule] = {}

    def register(self, module: OsintModule) -> None:
        if module.id in self._modules:
            raise ValueError(f"Duplicate OSINT module: {module.id}")
        self._modules[module.id] = module

    def list_modules(self, scan_type: ScanType | None = None) -> list[str]:
        if scan_type is None:
            return sorted(self._modules)
        if scan_type == ScanType.PASSIVE:
            return sorted(m.id for m in self._modules.values() if m.passive)
        return sorted(self._modules)

    def run(self, request: ScanRequest, module_ids: list[str] | None = None) -> list[ModuleResult]:
        if not request.authorization_ref.strip():
            return [
                ModuleResult(
                    module_id="registry",
                    ok=False,
                    summary="Missing authorization_ref",
                    error="authorization_required",
                )
            ]

        selected = module_ids or self.list_modules(request.scan_type)
        results: list[ModuleResult] = []
        for mid in selected:
            module = self._modules.get(mid)
            if module is None:
                results.append(
                    ModuleResult(module_id=mid, ok=False, summary="Unknown module", error="not_found")
                )
                continue
            if request.scan_type == ScanType.PASSIVE and not module.passive:
                results.append(
                    ModuleResult(
                        module_id=mid,
                        ok=False,
                        summary="Module not allowed in Passive scan",
                        error="passive_violation",
                    )
                )
                continue
            try:
                results.append(module.run(request))
            except Exception as exc:  # noqa: BLE001 — boundary for host adapters
                results.append(
                    ModuleResult(module_id=mid, ok=False, summary="Module failed", error=str(exc))
                )
        return results

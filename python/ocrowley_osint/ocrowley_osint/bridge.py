"""HTTP bridge helpers so TS toolkit can call Python BigBrother registry."""

from __future__ import annotations

from typing import Any

from .bigbrother import create_bigbrother_registry, bigbrother_available
from .registry import ScanRequest, ScanType


def run_bridge_scan(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Expected payload:
      {
        "seeds": [{"type","value","confidence","source"}],
        "authorizationRef": "...",
        "scanType": "Passive"|"Footprint"|"Investigate"|"All"
      }
    """
    auth = str(payload.get("authorizationRef") or payload.get("authorization_ref") or "")
    scan_type_raw = payload.get("scanType") or payload.get("scan_type") or "Passive"
    try:
        scan_type = ScanType(scan_type_raw)
    except ValueError:
        scan_type = ScanType.PASSIVE

    reg = create_bigbrother_registry()
    seeds = payload.get("seeds") or []
    items: list[dict[str, Any]] = []
    out_seeds: list[dict[str, Any]] = []

    for seed in seeds:
        value = str(seed.get("value") or "")
        if not value:
            continue
        results = reg.run(
            ScanRequest(target=value, scan_type=scan_type, authorization_ref=auth)
        )
        for r in results:
            items.append(
                {
                    "key": f"bb:{r.module_id}:{value}",
                    "entity": value,
                    "title": r.summary,
                    "source": r.module_id,
                    "snippet": str(r.findings)[:500] if r.findings else (r.error or ""),
                    "score": 70 if r.ok else 30,
                }
            )
            if r.ok:
                out_seeds.append(
                    {
                        "type": seed.get("type") or "unknown",
                        "value": value,
                        "confidence": 70,
                        "source": r.module_id,
                    }
                )

    return {
        "items": items,
        "seeds": out_seeds,
        "bigbrotherAvailable": bigbrother_available(),
        "modulesRun": len(items),
    }

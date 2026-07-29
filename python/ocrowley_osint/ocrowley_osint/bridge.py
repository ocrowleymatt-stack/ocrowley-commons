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
        "scanType": "Passive"|"Footprint"|"Investigate"|"All",
        "moduleIds": ["bb-phantom-id", ...]  # optional subset
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
    module_ids = payload.get("moduleIds") or payload.get("module_ids")
    if isinstance(module_ids, str):
        module_ids = [m.strip() for m in module_ids.split(",") if m.strip()]

    items: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    out_seeds: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    for seed in seeds:
        value = str(seed.get("value") or "")
        if not value:
            continue
        results = reg.run(
            ScanRequest(target=value, scan_type=scan_type, authorization_ref=auth),
            module_ids=list(module_ids) if module_ids else None,
        )
        for r in results:
            key = f"bb:{r.module_id}:{value}"
            if key in seen_keys:
                continue
            seen_keys.add(key)
            snippet = str(r.findings)[:500] if r.findings else (r.error or "")
            row = {
                "key": key,
                "entity": value,
                "title": r.summary,
                "source": r.module_id,
                "snippet": snippet,
                "score": 72 if r.ok else 28,
            }
            if r.ok:
                items.append(row)
                out_seeds.append(
                    {
                        "type": seed.get("type") or "unknown",
                        "value": value,
                        "confidence": 70,
                        "source": r.module_id,
                    }
                )
            else:
                skipped.append({**row, "error": r.error})

    return {
        "items": items,
        "seeds": out_seeds,
        "skipped": skipped,
        "bigbrotherAvailable": bigbrother_available(),
        "modulesRun": len(items) + len(skipped),
        "modulesRegistered": len(reg.list_modules()),
        "modulesHit": len(items),
        "scanType": scan_type.value,
        "privateUse": True,
    }

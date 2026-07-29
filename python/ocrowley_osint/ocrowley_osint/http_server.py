"""HTTP bridge so @ocrowley/osint who()/toolkit can call BigBrother privately.

  python -m ocrowley_osint.http_server --port 8798
  POST /scan  { "seeds": [...], "authorizationRef": "CASE-1", "scanType": "Passive" }
  GET  /health
  GET  /modules
"""

from __future__ import annotations

import argparse
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

from .bigbrother import BIG_BROTHER_MODULES, bigbrother_available, create_bigbrother_registry
from .bridge import run_bridge_scan
from .registry import ScanType

# People-first module ids for WHO lookups (passive subset).
PEOPLE_MODULE_IDS = (
    "bb-phantom-id",
    "bb-digital-footprint",
    "bb-dark-watch",
    "bb-breach-vault",
    "bb-wayback-spectre",
    "bb-mail-tracer",
    "bb-paste-dragnet",
    "bb-dork-studio",
    "bb-code-hunter",
    "bb-geoint-spy",
    "bb-ai-analyst",
)


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, default=str).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, X-OCROWLEY-OSINT-CASE")
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def enrich_people_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Ensure seeds exist from q/name and default to people-focused passive modules."""
    out = dict(payload)
    seeds = list(out.get("seeds") or [])
    q = str(out.get("q") or out.get("query") or out.get("name") or out.get("target") or "").strip()
    if q and not seeds:
        seeds.append({"type": "person" if " " in q or not q.startswith("@") else "username", "value": q.lstrip("@"), "confidence": 95, "source": "who"})
        email = re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", q)
        if email:
            seeds.append({"type": "email", "value": email.group(0), "confidence": 98, "source": "who"})
    # Prefer person / username / email seeds for WHO
    people_seeds = [s for s in seeds if str(s.get("type") or "") in {"person", "name", "username", "email", "phone"}]
    out["seeds"] = (people_seeds or seeds)[:6]
    out.setdefault("scanType", "Passive")
    if out.get("peopleFocus", True) and not out.get("moduleIds"):
        out["moduleIds"] = list(PEOPLE_MODULE_IDS)
    return out


class BigBrotherHandler(BaseHTTPRequestHandler):
    server_version = "ocrowley-bb-bridge/0.1"

    def log_message(self, fmt: str, *args: Any) -> None:  # noqa: A003
        # Quiet default; WHO server surfaces readiness via /health
        return

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-OCROWLEY-OSINT-CASE")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path in ("/health", "/api/health"):
            reg = create_bigbrother_registry()
            _json_response(
                self,
                200,
                {
                    "ok": True,
                    "service": "ocrowley-bigbrother-bridge",
                    "privateUse": True,
                    "bigbrotherAvailable": bigbrother_available(),
                    "modulesRegistered": len(reg.list_modules()),
                    "passiveModules": len(reg.list_modules(ScanType.PASSIVE)),
                },
            )
            return
        if path in ("/modules", "/api/modules"):
            _json_response(
                self,
                200,
                {
                    "modules": [
                        {"id": mid, "module": mod, "passive": passive}
                        for mid, mod, passive in BIG_BROTHER_MODULES
                    ],
                    "peopleModuleIds": list(PEOPLE_MODULE_IDS),
                    "bigbrotherAvailable": bigbrother_available(),
                },
            )
            return
        _json_response(self, 404, {"error": "Not found", "path": path})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON"})
            return

        case_hdr = self.headers.get("X-OCROWLEY-OSINT-CASE") or ""
        if case_hdr and not payload.get("authorizationRef"):
            payload["authorizationRef"] = case_hdr

        if path in ("/scan", "/api/scan"):
            enriched = enrich_people_payload(payload if isinstance(payload, dict) else {})
            if not str(enriched.get("authorizationRef") or "").strip():
                _json_response(
                    self,
                    401,
                    {"error": "Case authorization required", "hint": "authorizationRef or X-OCROWLEY-OSINT-CASE"},
                )
                return
            result = run_bridge_scan(enriched)
            result["privateUse"] = True
            result["status"] = "FINISHED"
            _json_response(self, 200, result)
            return

        _json_response(self, 404, {"error": "Not found", "path": path})


def serve(host: str = "127.0.0.1", port: int = 8798) -> None:
    httpd = ThreadingHTTPServer((host, port), BigBrotherHandler)
    print(f"ocrowley BigBrother bridge (private) → http://{host}:{port}")
    print(f"  the_big_brother installed: {bigbrother_available()}")
    print("  POST /scan  GET /health  GET /modules")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        httpd.server_close()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Private BigBrother HTTP bridge for ocrowley WHO")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8798)
    args = parser.parse_args(argv)
    serve(host=args.host, port=args.port)


if __name__ == "__main__":
    main()

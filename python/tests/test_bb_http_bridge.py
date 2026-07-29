import json
import threading
from http.client import HTTPConnection

from ocrowley_osint import PEOPLE_MODULE_IDS, enrich_people_payload, run_bridge_scan
from ocrowley_osint.http_server import BigBrotherHandler
from http.server import ThreadingHTTPServer


def test_enrich_people_payload_builds_seeds_and_modules():
    out = enrich_people_payload({"q": "Jane Doe jane@acme.com", "authorizationRef": "CASE-1"})
    assert any(s["type"] == "person" for s in out["seeds"])
    assert any(s["type"] == "email" for s in out["seeds"])
    assert out["moduleIds"] == list(PEOPLE_MODULE_IDS)
    assert out["scanType"] == "Passive"


def test_bridge_scan_people_subset():
    out = run_bridge_scan(
        {
            "authorizationRef": "CASE-1",
            "scanType": "Passive",
            "moduleIds": ["bb-phantom-id", "bb-breach-vault"],
            "seeds": [{"type": "username", "value": "alice", "confidence": 90, "source": "t"}],
        }
    )
    assert out["privateUse"] is True
    assert out["modulesRun"] >= 1
    # Without the_big_brother installed, hits land in skipped — still a valid private bridge
    assert isinstance(out["items"], list)
    assert isinstance(out["skipped"], list)
    assert out["modulesHit"] == len(out["items"])


def test_http_bridge_health_and_scan():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), BigBrotherHandler)
    port = httpd.server_address[1]
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        conn = HTTPConnection("127.0.0.1", port, timeout=5)
        conn.request("GET", "/health")
        health = json.loads(conn.getresponse().read().decode())
        assert health["ok"] is True
        assert health["privateUse"] is True
        assert health["modulesRegistered"] >= 19

        body = json.dumps(
            {
                "authorizationRef": "CASE-HTTP",
                "q": "Alice Example",
                "scanType": "Passive",
            }
        )
        conn.request("POST", "/scan", body=body, headers={"Content-Type": "application/json"})
        scan = json.loads(conn.getresponse().read().decode())
        assert scan["status"] == "FINISHED"
        assert "items" in scan
        assert scan["modulesRun"] >= 1
    finally:
        httpd.shutdown()
        httpd.server_close()

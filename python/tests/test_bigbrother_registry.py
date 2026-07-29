from ocrowley_osint import (
    BIG_BROTHER_MODULES,
    create_bigbrother_registry,
    run_bridge_scan,
    ScanType,
)
from ocrowley_osint.registry import ScanRequest


def test_all_bigbrother_modules_registered():
    reg = create_bigbrother_registry()
    ids = reg.list_modules()
    assert len(BIG_BROTHER_MODULES) >= 19
    assert len(ids) == len(BIG_BROTHER_MODULES)
    assert "bb-phantom-id" in ids
    assert "bb-dark-watch" in ids


def test_bigbrother_requires_auth_and_handles_missing_package():
    reg = create_bigbrother_registry()
    denied = reg.run(ScanRequest(target="alice", authorization_ref=""))
    assert denied[0].error == "authorization_required"

    results = reg.run(
        ScanRequest(target="alice", scan_type=ScanType.PASSIVE, authorization_ref="CASE-1")
    )
    # Without the_big_brother installed, modules report unavailable — still "available" via registry
    assert len(results) >= 1
    assert all(r.module_id.startswith("bb-") for r in results)


def test_bridge_scan_shape():
    out = run_bridge_scan(
        {
            "authorizationRef": "CASE-1",
            "scanType": "Passive",
            "seeds": [{"type": "username", "value": "alice", "confidence": 90, "source": "t"}],
        }
    )
    assert "items" in out
    assert "bigbrotherAvailable" in out
    assert isinstance(out["modulesRun"], int)

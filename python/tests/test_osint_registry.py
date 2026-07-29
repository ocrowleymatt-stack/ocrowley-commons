from ocrowley_osint import (
    OsintAuth,
    OsintRegistry,
    ScanRequest,
    ScanType,
    assert_osint_allowed,
    evaluate_osint_auth,
)
from ocrowley_osint.darkweb import parse_ahmia_html, risk_band
from ocrowley_osint.registry import ModuleResult


class _PassiveStub:
    id = "wayback"
    passive = True

    def run(self, request: ScanRequest) -> ModuleResult:
        return ModuleResult(module_id=self.id, ok=True, summary=f"ok:{request.target}", findings=[])


class _ActiveStub:
    id = "active-probe"
    passive = False

    def run(self, request: ScanRequest) -> ModuleResult:
        return ModuleResult(module_id=self.id, ok=True, summary="probed", findings=[{"t": request.target}])


def test_registry_passive_filter_and_auth():
    reg = OsintRegistry()
    reg.register(_PassiveStub())
    reg.register(_ActiveStub())

    missing = reg.run(ScanRequest(target="example.com", authorization_ref=""))
    assert missing[0].error == "authorization_required"

    results = reg.run(
        ScanRequest(target="example.com", scan_type=ScanType.PASSIVE, authorization_ref="CASE-1")
    )
    assert {r.module_id for r in results} == {"wayback"}
    assert results[0].ok


def test_osint_auth_and_ahmia_parse():
    ok, _ = evaluate_osint_auth(
        OsintAuth("a", ("osint-operator",), "CASE-1", "research", lawful_use_acknowledged=True),
        require_lawful_ack=True,
    )
    assert ok
    assert_osint_allowed(OsintAuth("a", ("investigator",), "CASE-1", "research"))

    html = """
    <li class="result">
      <h4><a href="http://example.onion">Example</a></h4>
      <p class="result-description">desc</p>
    </li>
    """
    mentions = parse_ahmia_html(html)
    assert len(mentions) == 1
    assert mentions[0].title == "Example"
    assert risk_band(4) == "high"

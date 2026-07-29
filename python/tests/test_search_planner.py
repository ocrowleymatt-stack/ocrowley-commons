from ocrowley_search import plan_sources, SOURCE_DEFAULTS

def test_person_plan():
    assert "people" in plan_sources("person")

def test_override():
    assert plan_sources("general", ["web", "bogus"]) == ["web"]

def test_defaults_cover_types():
    assert set(SOURCE_DEFAULTS) >= {"general", "person", "decision"}

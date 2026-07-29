from ocrowley_identity.normalise import *

def test_phone():
    assert normalise_phone("+44 7700 900123")

def test_email():
    out = normalise_email("Alice@Example.COM")
    assert "@" in out

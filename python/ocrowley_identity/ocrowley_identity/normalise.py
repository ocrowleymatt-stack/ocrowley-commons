"""
EPIC-9 TASK-034 — Identity Normalisation Helpers

Rules:
- Raw value is ALWAYS preserved in the database.
- normalised_value is the deterministic, searchable form.
- Normalisation never overwrites raw evidence.
- All functions are pure and deterministic.
"""
from __future__ import annotations

import re
import unicodedata


# ── Phone normalisation ───────────────────────────────────────────────────────

_PHONE_STRIP = re.compile(r"[\s\-\(\)\.\+]")
_PHONE_DIGITS = re.compile(r"^\d+$")

def normalise_phone(raw: str) -> str:
    """
    Normalise a phone number to a consistent digit string.

    Strategy:
    1. Strip whitespace, dashes, parens, dots, leading +.
    2. If the result starts with 0 and is 10+ digits, try to detect UK format
       (07xxx → 447xxx) — but only as a best-effort hint, not a guarantee.
    3. Return the stripped digit string. Callers should not assume E.164.

    Examples:
        +44 7700 900123  → 447700900123
        07700 900123     → 07700900123  (raw UK format preserved as digits)
        7700900123       → 7700900123
        (020) 7946-0958  → 02079460958
    """
    if not raw:
        return ""
    # Remove leading +
    s = raw.strip()
    if s.startswith("+"):
        s = s[1:]
    # Strip formatting characters
    s = _PHONE_STRIP.sub("", s)
    # Keep only digits
    s = re.sub(r"[^\d]", "", s)
    return s


# ── Email normalisation ───────────────────────────────────────────────────────

def normalise_email(raw: str) -> str:
    """
    Normalise an email address.

    Rules:
    - Lowercase the entire address.
    - Strip leading/trailing whitespace.
    - Do NOT strip dots or plus-aliases (too aggressive, may cause false positives).

    Examples:
        George.Harrison@Company.COM  → george.harrison@company.com
        " user@example.com "         → user@example.com
    """
    if not raw:
        return ""
    return raw.strip().lower()


# ── Username normalisation ────────────────────────────────────────────────────

def normalise_username(raw: str) -> str:
    """
    Normalise a username or handle.

    Rules:
    - Strip leading @ (common in social handles) but preserve the raw value.
    - Lowercase.
    - Strip whitespace.

    Examples:
        @gh_work   → gh_work
        GH_Work    → gh_work
        @GH_WORK   → gh_work
    """
    if not raw:
        return ""
    s = raw.strip()
    if s.startswith("@"):
        s = s[1:]
    return s.lower()


# ── URL / social profile normalisation ───────────────────────────────────────

_URL_TRAILING = re.compile(r"[/\s]+$")

def normalise_url(raw: str) -> str:
    """
    Normalise a URL or social profile link.

    Rules:
    - Lowercase scheme and host.
    - Strip trailing slashes and whitespace.
    - Preserve path case (some platforms are case-sensitive).

    Examples:
        HTTPS://Twitter.com/GH_Work/  → https://twitter.com/GH_Work
    """
    if not raw:
        return ""
    s = raw.strip()
    # Lowercase scheme and host only
    if "://" in s:
        scheme, rest = s.split("://", 1)
        if "/" in rest:
            host, path = rest.split("/", 1)
            s = f"{scheme.lower()}://{host.lower()}/{path}"
        else:
            s = f"{scheme.lower()}://{rest.lower()}"
    s = _URL_TRAILING.sub("", s)
    return s


# ── Display name normalisation ────────────────────────────────────────────────

_WHITESPACE = re.compile(r"\s+")

def normalise_display_name(raw: str) -> str:
    """
    Normalise a display name for fuzzy matching.

    Rules:
    - Lowercase.
    - Collapse multiple whitespace to single space.
    - Strip leading/trailing whitespace.
    - Decompose unicode to ASCII where possible (NFD → ASCII).
    - Preserve original character set otherwise.

    Examples:
        "  George  Harrison  "  → "george harrison"
        "Géorge"                → "george"
        "G. Harrison"           → "g. harrison"
    """
    if not raw:
        return ""
    # Unicode normalise
    s = unicodedata.normalize("NFD", raw)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower().strip()
    s = _WHITESPACE.sub(" ", s)
    return s


# ── Organisation role normalisation ──────────────────────────────────────────

def normalise_org_role(raw: str) -> str:
    """
    Normalise an organisation role string.

    Rules:
    - Lowercase.
    - Strip whitespace.
    - Collapse internal whitespace.

    Examples:
        "  Director  "  → "director"
        "Managing Director" → "managing director"
    """
    if not raw:
        return ""
    return _WHITESPACE.sub(" ", raw.strip().lower())


# ── Address normalisation ─────────────────────────────────────────────────────

def normalise_address(raw: str) -> str:
    """
    Normalise an address for deduplication.

    Rules:
    - Lowercase.
    - Collapse whitespace.
    - Strip trailing punctuation.

    This is intentionally conservative — addresses are hard to normalise
    reliably without a geocoding service.
    """
    if not raw:
        return ""
    s = raw.strip().lower()
    s = _WHITESPACE.sub(" ", s)
    s = s.rstrip(".,;")
    return s


# ── Dispatcher ────────────────────────────────────────────────────────────────

_NORMALISE_FN = {
    "phone": normalise_phone,
    "email": normalise_email,
    "username": normalise_username,
    "social_profile": normalise_url,
    "display_name": normalise_display_name,
    "organisation_role": normalise_org_role,
    "address": normalise_address,
    "image_ref": lambda x: x.strip() if x else "",  # no normalisation for image refs
}


def normalise(method_type: str, raw: str) -> str:
    """
    Normalise a raw identity method value by type.

    Returns the normalised value. Always deterministic.
    Falls back to stripped raw value for unknown types.
    """
    fn = _NORMALISE_FN.get(method_type, lambda x: x.strip() if x else "")
    return fn(raw)

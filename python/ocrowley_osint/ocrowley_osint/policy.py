from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class OsintAuth:
    actor_id: str
    roles: tuple[str, ...]
    authorization_ref: str
    purpose: str
    lawful_use_acknowledged: bool = False


_OPERATOR_ROLES = frozenset({"osint-operator", "investigator", "counsel"})


def evaluate_osint_auth(auth: OsintAuth, *, require_lawful_ack: bool = False) -> tuple[bool, str]:
    if not auth.authorization_ref.strip():
        return False, "OSINT requires a non-empty authorization_ref"
    if require_lawful_ack and not auth.lawful_use_acknowledged:
        return False, "Caller must acknowledge lawful, proportionate use"
    if not any(r in _OPERATOR_ROLES for r in auth.roles):
        return False, "Requires osint-operator, investigator, or counsel role"
    return True, "authorized"


def assert_osint_allowed(auth: OsintAuth, *, require_lawful_ack: bool = False) -> None:
    ok, reason = evaluate_osint_auth(auth, require_lawful_ack=require_lawful_ack)
    if not ok:
        raise PermissionError(reason)

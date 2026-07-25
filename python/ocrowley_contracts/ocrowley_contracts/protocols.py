"""Agent capability protocols. Implementations live in host apps — mocks not shipped as behavior."""
from __future__ import annotations
from typing import Any, Protocol, runtime_checkable

@runtime_checkable
class CodeGenerator(Protocol):
    def generate(self, plan: Any) -> Any: ...

@runtime_checkable
class TestRunner(Protocol):
    def run(self, target: Any) -> Any: ...

@runtime_checkable
class SecurityScanner(Protocol):
    def scan(self, target: Any) -> Any: ...

@runtime_checkable
class ArchitectureChecker(Protocol):
    def check(self, target: Any) -> Any: ...

@runtime_checkable
class CodeReviewer(Protocol):
    def review(self, target: Any) -> Any: ...

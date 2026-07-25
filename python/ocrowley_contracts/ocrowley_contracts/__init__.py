"""ocrowley_contracts — agent Protocols (from Life-os mock agents)."""
from .protocols import (
    CodeGenerator,
    TestRunner,
    SecurityScanner,
    ArchitectureChecker,
    CodeReviewer,
)

__version__ = "0.1.0"
__all__ = [
    "CodeGenerator",
    "TestRunner",
    "SecurityScanner",
    "ArchitectureChecker",
    "CodeReviewer",
]

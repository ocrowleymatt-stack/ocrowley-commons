"""Security scanner (mocked for V0.1)."""
from dataclasses import dataclass

@dataclass
class SecurityScan:
    task_id: str
    passed: bool = True
    issues: list = None
    risk_level: str = "GREEN"
    
    def __post_init__(self):
        if self.issues is None:
            self.issues = []

def scan_security(task_id: str, code_content: str = "") -> SecurityScan:
    """Scan code for security issues (mocked)."""
    # In V0.1: always pass
    # In V1: would scan for secrets, dangerous patterns, etc.
    return SecurityScan(
        task_id=task_id,
        passed=True,
        issues=[],
        risk_level="GREEN"
    )

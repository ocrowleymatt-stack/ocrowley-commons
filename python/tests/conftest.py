import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for pkg in [
    'ocrowley_identity',
    'ocrowley_search',
    'ocrowley_memory',
    'ocrowley_agents',
    'ocrowley_policy',
    'ocrowley_planner',
    'ocrowley_operator',
    'ocrowley_audit',
    'ocrowley_contracts',
]:
    sys.path.insert(0, str(ROOT / pkg))

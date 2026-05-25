from dataclasses import dataclass, field, asdict
from typing import Optional, Dict
from shared.constants.severity import Severity

@dataclass
class Finding:
    rule_id: str
    file_path: str
    severity: Severity
    title: str
    description: str
    recommended_fix: str
    resource_type: Optional[str] = None
    resource_name: Optional[str] = None
    line_number: Optional[int] = None
    code_snippet: Optional[str] = None
    confidence: float = 1.0
    
    # Remediation Engine Parameters
    remediation_type: Optional[str] = None  # Auto-fix, Manual review, Suggestion only
    remediation_diff: Optional[str] = None  # Compiled git patch
    remediation_mode: Optional[str] = None  # SAFE, SUGGESTIVE, AGGRESSIVE
    fix_confidence: float = 1.0
    explanation: Optional[Dict[str, str]] = None  # risk_summary, why_it_matters, recommended_action

    def to_dict(self) -> dict:
        d = asdict(self)
        d["severity"] = self.severity.value
        return d

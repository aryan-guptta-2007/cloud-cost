from dataclasses import dataclass, field, asdict
from typing import Optional
from shared.constants.severity import Severity

@dataclass
class Finding:
    rule_id: str
    file_path: str
    severity: Severity
    title: str
    description: str
    recommended_fix: str
    line_number: Optional[int] = None
    code_snippet: Optional[str] = None
    confidence: float = 1.0

    def to_dict(self) -> dict:
        d = asdict(self)
        # Ensure enums are serialized as strings
        d["severity"] = self.severity.value
        return d

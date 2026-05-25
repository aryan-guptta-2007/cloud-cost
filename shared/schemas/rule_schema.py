from dataclasses import dataclass, asdict
from shared.constants.severity import Severity
from shared.constants.category import Category

@dataclass
class RuleDefinition:
    id: str
    severity: Severity
    title: str
    description: str
    recommended_fix: str
    category: Category

    def to_dict(self) -> dict:
        return asdict(self)

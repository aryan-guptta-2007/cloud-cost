from abc import ABC, abstractmethod
from typing import List
from shared.constants.severity import Severity
from shared.constants.category import Category
from shared.schemas.finding_schema import Finding

class BaseRule(ABC):
    """
    Base class for all Terraform security scanning rules.
    """
    def __init__(
        self,
        id: str,
        severity: Severity,
        title: str,
        description: str,
        recommended_fix: str,
        category: Category,
        version: str = "1.0.0"
    ):
        self.id = id
        self.severity = severity
        self.title = title
        self.description = description
        self.recommended_fix = recommended_fix
        self.category = category
        self.version = version

    @abstractmethod
    def check(self, parsed_data: dict, file_path: str) -> List[Finding]:
        """
        Executes the security check against the normalized Terraform dictionary.
        Returns a list of Finding objects if violations are detected.
        """
        pass

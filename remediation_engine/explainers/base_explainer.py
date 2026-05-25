from abc import ABC, abstractmethod
from typing import Dict

class BaseExplainer(ABC):
    """
    Abstract base class for security finding explanation modules.
    """
    @abstractmethod
    def explain(self) -> Dict[str, str]:
        """
        Returns a dictionary representing the structured explanation of a security issue.
        Output Schema:
        {
            "risk_summary": "Short summary of what risk is present.",
            "why_it_matters": "In-depth detail on exploit vectors/exposure details.",
            "recommended_action": "Action steps required to resolve the vulnerability."
        }
        """
        pass

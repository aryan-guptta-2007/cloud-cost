import json
from typing import List
from shared.schemas.finding_schema import Finding

def format_findings_json(findings: List[Finding]) -> str:
    """
    Serializes a list of Finding objects into a formatted JSON string.
    """
    findings_list = [finding.to_dict() for finding in findings]
    return json.dumps(findings_list, indent=2)

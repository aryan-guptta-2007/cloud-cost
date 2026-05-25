from typing import List
from remediation_engine.fixers.base_fixer import BaseFixer

class AwsIamWildcardFixer(BaseFixer):
    """
    Suggests scoped permissions to replace wildcards.
    Runs as SUGGESTION_ONLY / MANUAL_REVIEW due to high application-break risk.
    """
    def __init__(self):
        super().__init__("AWS_IAM_WILDCARD", "iam_wildcard_fix.template")

    def _modify_block(self, lines: List[str], start: int, end: int) -> List[str]:
        modified = list(lines)
        template_content = self.load_template()

        # Locate action wildcard lines and suggest scoped replacement
        for idx in range(start + 1, end):
            line = lines[idx]
            stripped = line.strip()
            if "Action" in stripped and "*" in stripped:
                indent = line[:len(line) - len(line.lstrip())]
                comma = "," if stripped.endswith(",") else ""
                modified[idx] = f"{indent}{template_content}{comma}\n"
                break
        return modified

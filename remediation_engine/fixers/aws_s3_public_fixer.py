import re
from typing import List
from remediation_engine.fixers.base_fixer import BaseFixer

class AwsS3PublicFixer(BaseFixer):
    """
    Remediates public S3 buckets by setting acl = "private".
    """
    def __init__(self):
        super().__init__("AWS_S3_PUBLIC", "s3_acl_fix.template")

    def _modify_block(self, lines: List[str], start: int, end: int) -> List[str]:
        modified = list(lines)
        template_content = self.load_template()

        # Find the acl line within the resource block range
        for idx in range(start + 1, end):
            line = lines[idx]
            stripped = line.strip()
            if stripped.startswith("acl") and ("public-read" in stripped or "public-read-write" in stripped):
                # Match original line indentation
                indent = line[:len(line) - len(line.lstrip())]
                modified[idx] = f"{indent}{template_content}\n"
                break
        return modified

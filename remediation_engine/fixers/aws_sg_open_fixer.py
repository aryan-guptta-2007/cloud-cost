from typing import List
from remediation_engine.fixers.base_fixer import BaseFixer

class AwsSgOpenFixer(BaseFixer):
    """
    Remediates wide-open security group ingress rules by replacing open CIDRs
    with a placeholder trusted IP range template.
    """
    def __init__(self):
        super().__init__("AWS_SG_OPEN", "sg_restrict.template")

    def _modify_block(self, lines: List[str], start: int, end: int) -> List[str]:
        modified = list(lines)
        template_content = self.load_template()

        # Find and replace all open cidr_blocks lines within the block
        for idx in range(start + 1, end):
            line = lines[idx]
            stripped = line.strip()
            if "cidr_blocks" in stripped and ("0.0.0.0/0" in stripped or "::/0" in stripped):
                indent = line[:len(line) - len(line.lstrip())]
                modified[idx] = f"{indent}{template_content}\n"
        return modified

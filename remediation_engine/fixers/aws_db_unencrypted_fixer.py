from typing import List
from remediation_engine.fixers.base_fixer import BaseFixer

class AwsDbUnencryptedFixer(BaseFixer):
    """
    Remediates unencrypted RDS databases by setting storage_encrypted = true.
    Handles both existing 'false' configurations and omitted parameters.
    """
    def __init__(self):
        super().__init__("AWS_DB_UNENCRYPTED", "db_encrypt.template")

    def _modify_block(self, lines: List[str], start: int, end: int) -> List[str]:
        modified = list(lines)
        template_content = self.load_template()

        # Check if storage_encrypted is already explicitly defined
        found_idx = -1
        for idx in range(start + 1, end):
            line = lines[idx]
            stripped = line.strip()
            if stripped.startswith("storage_encrypted"):
                found_idx = idx
                break

        if found_idx != -1:
            line = lines[found_idx]
            indent = line[:len(line) - len(line.lstrip())]
            modified[found_idx] = f"{indent}{template_content}\n"
        else:
            # Omitted: Insert the attribute right before the closing brace line
            start_line = lines[start]
            # Match block indentation and add standard spacing
            indent = start_line[:len(start_line) - len(start_line.lstrip())] + "  "
            modified.insert(end, f"{indent}{template_content}\n")

        return modified

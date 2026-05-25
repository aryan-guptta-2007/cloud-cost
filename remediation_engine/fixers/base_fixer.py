import os
import re
from typing import List, Tuple
from remediation_engine.validators.syntax_validator import validate_tf_syntax

class BaseFixer:
    """
    Base class for Terraform resource block remediation.
    Runs updates in-memory and validates brace balance and syntax.
    """
    def __init__(self, rule_id: str, template_name: str):
        self.rule_id = rule_id
        self.template_name = template_name

    def load_template(self) -> str:
        """Loads the raw configuration replacement template."""
        current_dir = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(current_dir, "..", "templates", self.template_name)
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()

    def get_resource_block(self, lines: List[str], resource_type: str, resource_name: str) -> Tuple[int, int]:
        """
        Locates the starting and ending line indices (0-indexed) of a resource block.
        """
        pattern = rf'resource\s+["\']?{resource_type}["\']?\s+["\']?{resource_name}["\']?'
        start_line = -1
        for idx, line in enumerate(lines):
            if re.search(pattern, line):
                start_line = idx
                break
        
        if start_line == -1:
            return -1, -1

        brace_count = 0
        end_line = -1
        for idx in range(start_line, len(lines)):
            line = lines[idx]
            brace_count += line.count("{")
            brace_count -= line.count("}")
            if brace_count <= 0 and idx > start_line:
                end_line = idx
                break
        return start_line, end_line

    def apply_fix_content(self, original_content: str, resource_type: str, resource_name: str) -> str:
        """
        Applies remediation directly to HCL content in-memory and validates HCL syntax.
        """
        lines = original_content.splitlines(keepends=True)
        start, end = self.get_resource_block(lines, resource_type, resource_name)
        if start == -1 or end == -1:
            raise ValueError(f"Could not locate resource block for {resource_type}.{resource_name}")

        modified_lines = self._modify_block(lines, start, end)
        modified_content = "".join(modified_lines)

        # Validate syntax
        is_valid, err_msg = validate_tf_syntax(modified_content)
        if not is_valid:
            raise ValueError(f"Generated remediation has invalid syntax: {err_msg}")

        return modified_content

    def apply_fix(self, file_path: str, resource_type: str, resource_name: str) -> str:
        """
        Loads the target file, modifies the block in-memory, validates HCL integrity,
        and returns the modified content string.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Target file not found: {file_path}")
            
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        return self.apply_fix_content(content, resource_type, resource_name)

    def _modify_block(self, lines: List[str], start: int, end: int) -> List[str]:
        """To be implemented by subclasses."""
        raise NotImplementedError

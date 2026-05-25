import re
from datetime import datetime
from typing import Dict, Set, Tuple, Optional

# Regex to capture: sentra-ignore: <RULE_ID> [expires=YYYY-MM-DD] [-- <reason>]
IGNORE_REGEX = re.compile(
    r'(?:#|//)\s*sentra-ignore:\s*([A-Z0-9_]+)'  # Matches Rule ID
    r'(?:\s+expires=(\d{4}-\d{2}-\d{2}))?'        # Matches optional expires tag
    r'(?:\s+--\s*(.*))?'                          # Matches optional reason description
)

def parse_ignore_annotations(content: str) -> Dict[str, Dict[str, str]]:
    """
    Parses Terraform HCL string to identify active ignore annotations.
    Only maps active, non-expired suppressions to the immediate next resource block.
    
    Returns a dictionary mapping:
    "resource_type.resource_name" -> { "RULE_ID": "reason" }
    """
    lines = content.splitlines()
    ignores = {}
    
    idx = 0
    while idx < len(lines):
        line = lines[idx].strip()
        match = IGNORE_REGEX.search(line)
        if match:
            rule_id = match.group(1)
            expiration_str = match.group(2)
            reason = (match.group(3) or "").strip()
            
            # Default reason description warn
            if not reason:
                reason = "No reason provided (suppression needs explanation)"

            # Check expiration date
            is_expired = False
            if expiration_str:
                try:
                    expiration_date = datetime.strptime(expiration_str, "%Y-%m-%d").date()
                    # Today is 2026-05-25 (based on local metadata)
                    today = datetime.now().date()
                    if today > expiration_date:
                        is_expired = True
                except ValueError:
                    # Ignore invalid date formats
                    pass
            
            if not is_expired:
                # Associate with the immediate next resource block
                next_type, next_name = find_next_resource_block(lines, idx + 1)
                if next_type and next_name:
                    resource_key = f"{next_type}.{next_name}"
                    if resource_key not in ignores:
                        ignores[resource_key] = {}
                    ignores[resource_key][rule_id] = reason
                    
        idx += 1
        
    return ignores

def find_next_resource_block(lines: list, start_idx: int) -> Tuple[Optional[str], Optional[str]]:
    """
    Helper to search subsequent lines for the immediate next resource block declaration.
    Stop searching if a line contains another ignore comment or is empty/comment.
    """
    resource_pattern = re.compile(r'resource\s+["\']?([a-zA-Z0-9_]+)["\']?\s+["\']?([a-zA-Z0-9_]+)["\']?')
    
    for idx in range(start_idx, len(lines)):
        line = lines[idx].strip()
        if "sentra-ignore:" in line:
            return None, None
            
        match = resource_pattern.match(line)
        if match:
            return match.group(1), match.group(2)
            
    return None, None

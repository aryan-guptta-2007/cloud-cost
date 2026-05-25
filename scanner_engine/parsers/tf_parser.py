import os
import hcl2
from typing import Dict, Any

class ParseError(Exception):
    """Custom exception raised when HCL2 parsing fails."""
    pass

def parse_tf_file(filepath: str) -> Dict[str, Any]:
    """
    Reads a Terraform file and parses it using python-hcl2.
    Normalizes the parsed HCL AST to make it easy to query in rule checks.
    """
    if not os.path.exists(filepath):
        raise ParseError(f"File not found: {filepath}")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = hcl2.load(f)
        return normalize_tf_data(data)
    except Exception as e:
        raise ParseError(f"Failed to parse Terraform file {filepath}: {str(e)}")

def normalize_key(k: Any) -> Any:
    """Strips surrounding double quotes from dictionary keys if they are strings."""
    if isinstance(k, str):
        if k.startswith('"') and k.endswith('"'):
            return k[1:-1]
    return k

def normalize_tf_data(data: dict) -> dict:
    """Normalizes top-level lists of dicts from python-hcl2 output."""
    normalized = {}
    for key, value in data.items():
        norm_key = normalize_key(key)
        if isinstance(value, list):
            normalized[norm_key] = normalize_list_of_dicts(value)
        else:
            normalized[norm_key] = normalize_val(value)
    return normalized

def normalize_list_of_dicts(lst: list):
    """Merges a list of dictionaries, recursing to normalize sub-values."""
    merged = {}
    for item in lst:
        if isinstance(item, dict):
            for k, v in item.items():
                norm_key = normalize_key(k)
                if norm_key in merged:
                    merged_val = merged[norm_key]
                    normalized_v = normalize_val(v)
                    if isinstance(merged_val, dict) and isinstance(normalized_v, dict):
                        merged[norm_key] = {**merged_val, **normalized_v}
                    elif isinstance(merged_val, list):
                        if isinstance(normalized_v, list):
                            merged[norm_key] = merged_val + normalized_v
                        else:
                            merged[norm_key] = merged_val + [normalized_v]
                    else:
                        merged[norm_key] = [merged_val, normalized_v]
                else:
                    merged[norm_key] = normalize_val(v)
        else:
            return [normalize_val(x) for x in lst]
    return merged

def normalize_val(val):
    """Recursively simplifies single-element lists, list of dicts, and sub-dicts."""
    if isinstance(val, list):
        if len(val) == 1:
            return normalize_val(val[0])
        if all(isinstance(x, dict) for x in val):
            return normalize_list_of_dicts(val)
        return [normalize_val(x) for x in val]
    elif isinstance(val, dict):
        return {normalize_key(k): normalize_val(v) for k, v in val.items()}
    elif isinstance(val, str):
        if val.startswith('"') and val.endswith('"'):
            return val[1:-1]
    return val

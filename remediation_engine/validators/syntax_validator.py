import io
import hcl2
import os
import copy
import shutil
import subprocess
import tempfile
from typing import Tuple
from scanner_engine.parsers.tf_parser import parse_tf_string

def validate_brace_balance(content: str) -> bool:
    """
    Verifies that all curly braces '{' and '}' are balanced and correctly nested.
    """
    balance = 0
    for char in content:
        if char == '{':
            balance += 1
        elif char == '}':
            balance -= 1
        if balance < 0:
            return False
    return balance == 0

def validate_tf_syntax(content: str) -> Tuple[bool, str]:
    """
    Validates the Terraform configuration syntax.
    Returns a tuple (is_valid, error_message).
    """
    if not validate_brace_balance(content):
        return False, "Brace mismatch: Curly braces are not balanced or are nested incorrectly."

    try:
        hcl2.load(io.StringIO(content))
        return True, ""
    except Exception as e:
        return False, f"HCL Parser Syntax Error: {str(e)}"

def validate_via_terraform_cli(content: str) -> Tuple[bool, str]:
    """
    Validates the Terraform configuration using the Terraform CLI.
    Gracefully falls back (returns True) if the terraform CLI is not installed.
    """
    tf_path = shutil.which("terraform")
    if not tf_path:
        return True, "Terraform CLI not found in PATH. Skipping CLI validation."

    temp_dir = tempfile.mkdtemp(prefix="sentra-tf-val-")
    try:
        temp_file_path = os.path.join(temp_dir, "main.tf")
        with open(temp_file_path, "w", encoding="utf-8") as f:
            f.write(content)

        result = subprocess.run(
            [tf_path, "validate", "-no-color"],
            cwd=temp_dir,
            capture_output=True,
            text=True,
            timeout=5.0
        )
        
        if result.returncode != 0:
            err_msg = result.stderr or result.stdout
            # If the error is about missing provider/plugin initialization, ignore it.
            # Avoid simple 'init' match which hits 'definition'.
            ignore_phrases = [
                "plugin", "initialize", "provider", "backend", "terraform init",
                "run init", "initialization", "missing backend", "registry", 
                "failed to query", "requires provider", "not installed"
            ]
            if any(phrase.lower() in err_msg.lower() for phrase in ignore_phrases):
                return True, "CLI validated (non-blocking warning: environment not initialized)"
            return False, f"Terraform CLI validation failed:\n{err_msg}"
            
        return True, ""
    except subprocess.TimeoutExpired:
        return False, "Terraform CLI validation timed out."
    except Exception as e:
        return False, f"Terraform CLI validation execution error: {str(e)}"
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

def validate_resource_boundary(
    original_content: str,
    modified_content: str,
    resource_type: str,
    resource_name: str
) -> Tuple[bool, str]:
    """
    Verifies that ONLY the targeted resource (by type and name) has been changed
    between the original and modified HCL configurations.
    Uses AST parsing to guarantee no silent mutations occur outside the block boundaries.
    """
    if not resource_type or not resource_name:
        return False, "Missing resource type or name for boundary validation."

    try:
        orig_dict = parse_tf_string(original_content)
        mod_dict = parse_tf_string(modified_content)
    except Exception as e:
        return False, f"HCL parsing error during boundary validation: {str(e)}"

    orig_clean = copy.deepcopy(orig_dict)
    mod_clean = copy.deepcopy(mod_dict)

    def remove_resource(d):
        if "resource" not in d or not isinstance(d["resource"], dict):
            return
        
        res_dict = d["resource"]
        if resource_type in res_dict:
            type_map = res_dict[resource_type]
            if isinstance(type_map, dict) and resource_name in type_map:
                del type_map[resource_name]
                if not type_map:
                    del res_dict[resource_type]

    remove_resource(orig_clean)
    remove_resource(mod_clean)

    if orig_clean != mod_clean:
        return False, f"Validation failure: Changes detected outside targeted resource '{resource_type}.{resource_name}'."
    return True, ""


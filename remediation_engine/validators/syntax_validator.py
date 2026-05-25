import io
import hcl2
from typing import Tuple

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

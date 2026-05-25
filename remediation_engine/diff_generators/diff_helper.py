import difflib

def generate_unified_diff(original_content: str, modified_content: str, file_path: str) -> str:
    """
    Generates a standard unified Git diff between the original and modified file strings.
    """
    original_lines = original_content.splitlines(keepends=True)
    modified_lines = modified_content.splitlines(keepends=True)
    
    diff = difflib.unified_diff(
        original_lines,
        modified_lines,
        fromfile=f"a/{file_path}",
        tofile=f"b/{file_path}"
    )
    return "".join(diff)

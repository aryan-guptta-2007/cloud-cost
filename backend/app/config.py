import os

# GitHub App Credentials
GITHUB_APP_ID = os.getenv("GITHUB_APP_ID", "")
GITHUB_PRIVATE_KEY = os.getenv("GITHUB_PRIVATE_KEY", "")
GITHUB_WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")

# Safety Limits
MAX_FILE_SIZE_BYTES = int(os.getenv("MAX_FILE_SIZE_BYTES", "1000000"))  # 1MB default
MAX_PR_FILES = int(os.getenv("MAX_PR_FILES", "50"))
SCAN_TIMEOUT_SECONDS = float(os.getenv("SCAN_TIMEOUT_SECONDS", "30.0"))

def get_private_key() -> str:
    """
    Returns the raw PEM private key contents.
    Supports either the raw key string or a file path to the key.
    """
    key = GITHUB_PRIVATE_KEY
    if not key:
        return ""
    if os.path.exists(key):
        with open(key, "r", encoding="utf-8") as f:
            return f.read().strip()
    return key.strip()

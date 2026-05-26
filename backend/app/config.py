import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# GitHub App Credentials
GITHUB_APP_ID = str(
    os.getenv("GITHUB_APP_ID", "")
).strip()

GITHUB_PRIVATE_KEY = str(
    os.getenv("GITHUB_PRIVATE_KEY", "")
).strip()

GITHUB_WEBHOOK_SECRET = str(
    os.getenv("GITHUB_WEBHOOK_SECRET", "")
).strip()

# Safety Limits
MAX_FILE_SIZE_BYTES = int(
    os.getenv("MAX_FILE_SIZE_BYTES", "1000000")
)

MAX_PR_FILES = int(
    os.getenv("MAX_PR_FILES", "50")
)

SCAN_TIMEOUT_SECONDS = float(
    os.getenv("SCAN_TIMEOUT_SECONDS", "30.0")
)

# Remediation Automation Modes
class RemediationMode:
    COMMENT_ONLY = "comment_only"
    PREVIEW_ONLY = "preview_only"
    APPROVAL_REQUIRED = "approval_required"
    AUTONOMOUS = "autonomous"

SENTRA_REMEDIATION_MODE = str(
    os.getenv("SENTRA_REMEDIATION_MODE", RemediationMode.APPROVAL_REQUIRED)
).strip().lower()



def get_private_key() -> str:
    """
    Returns the raw PEM private key contents.
    Supports both:
    1. Direct PEM text
    2. File path to PEM file
    """

    key = GITHUB_PRIVATE_KEY

    if not key:
        return ""

    # If key is a filepath, read the file
    if os.path.exists(key):
        with open(key, "r", encoding="utf-8") as f:
            return f.read().strip()

    # Otherwise treat it as raw key text
    return key.strip()
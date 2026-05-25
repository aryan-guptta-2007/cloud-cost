from enum import Enum

class RemediationType(str, Enum):
    AUTO_FIX = "AUTO_FIX"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    SUGGESTION_ONLY = "SUGGESTION_ONLY"

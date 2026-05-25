from dataclasses import dataclass, field, asdict
from typing import Optional, Dict
from shared.constants.severity import Severity


class FixSafetyTier:
    """
    Fix Safety Tier classification for autofix eligibility.

    Tiers:
    - SAFE: Deterministic, minimal-change fix. No human inference required.
      Example: S3 ACL private, DB encryption boolean flag.
    - REVIEW_REQUIRED: Fix is likely correct but contextual. Human must verify.
      Example: Security group CIDR — correct logic, but CIDR value is placeholder.
    - EXPERIMENTAL: Heuristic or AI-assisted fix. High confidence but not guaranteed.
      Reserved for future AI-assisted remediations. Never auto-merged.
    - NONE: No autofix available. Manual review is the only path.
      Example: IAM wildcard — permissions risk too high for automation.
    """
    SAFE = "SAFE"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    EXPERIMENTAL = "EXPERIMENTAL"
    NONE = "NONE"


@dataclass
class Finding:
    rule_id: str
    file_path: str
    severity: Severity
    title: str
    description: str
    recommended_fix: str
    rule_version: str = "1.0.0"           # Version metadata of the scanner rule
    resource_type: Optional[str] = None
    resource_name: Optional[str] = None
    line_number: Optional[int] = None
    code_snippet: Optional[str] = None
    confidence: float = 1.0

    # Remediation Engine Parameters
    remediation_type: Optional[str] = None   # AUTO_FIX, MANUAL_REVIEW, SUGGESTION_ONLY
    remediation_diff: Optional[str] = None   # Compiled git patch
    remediation_mode: Optional[str] = None   # SAFE, SUGGESTIVE, AGGRESSIVE
    fix_confidence: float = 1.0
    explanation: Optional[Dict[str, str]] = None  # risk_summary, why_it_matters, recommended_action

    # Autofix Policy Fields (stamped by scan_service from autofix_policy.py)
    safe_for_autofix: bool = False           # True only for SAFE tier rules with autofix_allowed=True
    requires_human_review: bool = True       # Always True for REVIEW_REQUIRED and EXPERIMENTAL
    fix_safety_tier: str = FixSafetyTier.NONE  # FixSafetyTier classification

    def to_dict(self) -> dict:
        d = asdict(self)
        d["severity"] = self.severity.value
        return d

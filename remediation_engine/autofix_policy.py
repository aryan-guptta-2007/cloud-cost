"""
autofix_policy.py — Centralized Autofix Eligibility Matrix

This is the SINGLE SOURCE OF TRUTH for:
- Which rules are eligible for automated PR creation
- The Fix Safety Tier classification for each rule
- Whether a human review is required on the generated PR
- Any contextual review notes to include in the PR body

ADDING A NEW RULE:
  1. Add an entry to _POLICY_MATRIX below
  2. Do NOT add eligibility logic anywhere else — reference this module

CHANGING A POLICY:
  1. Update the entry here
  2. All services derive their behavior from this module automatically

DESIGN PRINCIPLE:
  When in doubt, default to AUTOFIX_ALLOWED=False and TIER=NONE.
  Trust is earned incrementally. Safety is the default.
"""

from dataclasses import dataclass
from typing import Optional
from shared.schemas.finding_schema import FixSafetyTier


@dataclass(frozen=True)
class AutofixPolicy:
    """Immutable policy definition for a single rule's autofix behavior."""
    rule_id: str
    autofix_allowed: bool
    safe_for_autofix: bool               # True only when SAFE tier + no CIDR/IAM risk
    requires_human_review: bool          # PR requires explicit review before merge
    fix_safety_tier: str                 # FixSafetyTier constant
    pr_review_note: Optional[str] = None # Shown in PR body for conditional rules


# ============================================================================
# THE AUTOFIX ELIGIBILITY MATRIX
# ============================================================================
# Rule ID              | Allowed | Safe  | Review | Tier             | Note
# ---------------------|---------|-------|--------|------------------|------
# AWS_S3_PUBLIC        | YES     | True  | No     | SAFE             | Deterministic ACL swap
# AWS_DB_UNENCRYPTED   | YES     | True  | No     | SAFE             | Single boolean flag
# AWS_SG_OPEN          | COND    | False | Yes    | REVIEW_REQUIRED  | CIDR placeholder — must be updated
# AWS_IAM_WILDCARD     | NO      | False | Yes    | NONE             | Never auto-fixed — permissions risk
# ============================================================================

_POLICY_MATRIX: dict[str, AutofixPolicy] = {
    "AWS_S3_PUBLIC": AutofixPolicy(
        rule_id="AWS_S3_PUBLIC",
        autofix_allowed=True,
        safe_for_autofix=True,
        requires_human_review=False,
        fix_safety_tier=FixSafetyTier.SAFE,
        pr_review_note=None
    ),
    "AWS_DB_UNENCRYPTED": AutofixPolicy(
        rule_id="AWS_DB_UNENCRYPTED",
        autofix_allowed=True,
        safe_for_autofix=True,
        requires_human_review=False,
        fix_safety_tier=FixSafetyTier.SAFE,
        pr_review_note=None
    ),
    "AWS_SG_OPEN": AutofixPolicy(
        rule_id="AWS_SG_OPEN",
        autofix_allowed=True,
        safe_for_autofix=False,
        requires_human_review=True,
        fix_safety_tier=FixSafetyTier.REVIEW_REQUIRED,
        pr_review_note=(
            "⚠️ **Action Required Before Merging**: "
            "This fix substitutes `0.0.0.0/0` with `YOUR_TRUSTED_IP_RANGE`. "
            "You MUST replace `YOUR_TRUSTED_IP_RANGE` with your actual CIDR block "
            "(e.g. `203.0.113.0/24`) before merging. Merging without this change "
            "will block all inbound traffic to the security group."
        )
    ),
    "AWS_IAM_WILDCARD": AutofixPolicy(
        rule_id="AWS_IAM_WILDCARD",
        autofix_allowed=False,
        safe_for_autofix=False,
        requires_human_review=True,
        fix_safety_tier=FixSafetyTier.NONE,
        pr_review_note=(
            "IAM policy remediations require manual review by a security engineer. "
            "Wildcard permissions are context-dependent and cannot be safely "
            "auto-remediated without understanding the full permission scope."
        )
    ),
}

# Default policy for unknown rules — never auto-fix unknown findings
_DEFAULT_POLICY = AutofixPolicy(
    rule_id="UNKNOWN",
    autofix_allowed=False,
    safe_for_autofix=False,
    requires_human_review=True,
    fix_safety_tier=FixSafetyTier.NONE,
    pr_review_note="Unknown rule — manual review required."
)


def get_autofix_policy(rule_id: str) -> AutofixPolicy:
    """
    Returns the AutofixPolicy for the given rule_id.
    Falls back to a safe DEFAULT_POLICY for unknown rules.
    Never raises — always returns a policy.
    """
    return _POLICY_MATRIX.get(rule_id, _DEFAULT_POLICY)


def get_all_autofix_eligible_rules() -> list[str]:
    """Returns list of rule IDs where autofix_allowed=True."""
    return [rule_id for rule_id, policy in _POLICY_MATRIX.items() if policy.autofix_allowed]


def get_safe_autofix_rules() -> list[str]:
    """Returns list of rule IDs where safe_for_autofix=True (SAFE tier only)."""
    return [rule_id for rule_id, policy in _POLICY_MATRIX.items() if policy.safe_for_autofix]

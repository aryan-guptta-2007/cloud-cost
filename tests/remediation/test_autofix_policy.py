import os
import sys
import pytest

parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from remediation_engine.autofix_policy import (
    get_autofix_policy,
    get_all_autofix_eligible_rules,
    get_safe_autofix_rules,
)
from shared.schemas.finding_schema import FixSafetyTier


def test_s3_public_policy_is_safe_autofix():
    """S3 ACL fix is the most trustworthy — SAFE tier, no human review needed."""
    policy = get_autofix_policy("AWS_S3_PUBLIC")
    assert policy.autofix_allowed is True
    assert policy.safe_for_autofix is True
    assert policy.requires_human_review is False
    assert policy.fix_safety_tier == FixSafetyTier.SAFE
    assert policy.pr_review_note is None


def test_db_unencrypted_policy_is_safe_autofix():
    """DB encryption is a single-boolean flip — SAFE tier, no human review needed."""
    policy = get_autofix_policy("AWS_DB_UNENCRYPTED")
    assert policy.autofix_allowed is True
    assert policy.safe_for_autofix is True
    assert policy.requires_human_review is False
    assert policy.fix_safety_tier == FixSafetyTier.SAFE
    assert policy.pr_review_note is None


def test_sg_open_policy_is_conditional():
    """Security group fix is allowed but REVIEW_REQUIRED due to CIDR placeholder."""
    policy = get_autofix_policy("AWS_SG_OPEN")
    assert policy.autofix_allowed is True
    assert policy.safe_for_autofix is False      # Not SAFE — CIDR must be reviewed
    assert policy.requires_human_review is True
    assert policy.fix_safety_tier == FixSafetyTier.REVIEW_REQUIRED
    assert policy.pr_review_note is not None
    assert "YOUR_TRUSTED_IP_RANGE" in policy.pr_review_note


def test_iam_wildcard_is_never_autofixed():
    """IAM wildcard MUST NEVER be auto-fixed. This is a safety invariant."""
    policy = get_autofix_policy("AWS_IAM_WILDCARD")
    assert policy.autofix_allowed is False        # NEVER allowed
    assert policy.safe_for_autofix is False
    assert policy.requires_human_review is True
    assert policy.fix_safety_tier == FixSafetyTier.NONE


def test_unknown_rule_returns_safe_default():
    """Unknown rules must default to the most restrictive policy (never auto-fix)."""
    policy = get_autofix_policy("UNKNOWN_RULE_XYZ")
    assert policy.autofix_allowed is False
    assert policy.safe_for_autofix is False
    assert policy.requires_human_review is True
    assert policy.fix_safety_tier == FixSafetyTier.NONE


def test_get_all_autofix_eligible_rules():
    """Should return exactly the rules with autofix_allowed=True."""
    eligible = get_all_autofix_eligible_rules()
    assert "AWS_S3_PUBLIC" in eligible
    assert "AWS_DB_UNENCRYPTED" in eligible
    assert "AWS_SG_OPEN" in eligible       # Conditional but still allowed
    assert "AWS_IAM_WILDCARD" not in eligible  # NEVER


def test_get_safe_autofix_rules():
    """Should return only SAFE tier rules (no human review required)."""
    safe_rules = get_safe_autofix_rules()
    assert "AWS_S3_PUBLIC" in safe_rules
    assert "AWS_DB_UNENCRYPTED" in safe_rules
    assert "AWS_SG_OPEN" not in safe_rules      # REVIEW_REQUIRED, not SAFE
    assert "AWS_IAM_WILDCARD" not in safe_rules


def test_policy_objects_are_immutable():
    """AutofixPolicy is frozen=True — attempting to modify should raise AttributeError."""
    policy = get_autofix_policy("AWS_S3_PUBLIC")
    with pytest.raises((AttributeError, TypeError)):
        policy.autofix_allowed = False  # type: ignore


def test_iam_wildcard_invariant_is_hard_constraint():
    """
    Critical safety invariant test.
    IAM wildcard must ALWAYS return autofix_allowed=False regardless of future changes.
    This test acts as a regression guard for the most dangerous rule.
    """
    policy = get_autofix_policy("AWS_IAM_WILDCARD")
    assert policy.autofix_allowed is False, (
        "CRITICAL SAFETY VIOLATION: AWS_IAM_WILDCARD autofix_allowed must ALWAYS be False. "
        "IAM wildcard permissions cannot be safely auto-remediated without human review."
    )

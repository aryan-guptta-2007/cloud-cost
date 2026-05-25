import os
import sys
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from shared.schemas.finding_schema import Finding, FixSafetyTier
from shared.constants.severity import Severity
from backend.app.services.autofix_service import run_autofix_workflows, _build_branch_name
from backend.app.services.autofix_pr_service import (
    compute_pr_fingerprint,
    compute_source_content_hash,
    build_autofix_pr_title,
)


def make_finding(
    rule_id: str,
    safe_for_autofix: bool = True,
    fix_safety_tier: str = FixSafetyTier.SAFE,
    requires_human_review: bool = False,
    severity: Severity = Severity.HIGH,
    has_diff: bool = True
) -> Finding:
    return Finding(
        rule_id=rule_id,
        file_path="infra/main.tf",
        severity=severity,
        title=f"Test Finding for {rule_id}",
        description="Test description.",
        recommended_fix="Apply the fix.",
        rule_version="1.0.0",
        resource_type="aws_s3_bucket" if "S3" in rule_id else "aws_db_instance",
        resource_name="test_resource",
        fix_confidence=1.0,
        safe_for_autofix=safe_for_autofix,
        requires_human_review=requires_human_review,
        fix_safety_tier=fix_safety_tier,
        remediation_diff="--- a/main.tf\n+++ b/main.tf\n@@ -1 +1 @@\n- acl = \"public-read\"\n+ acl = \"private\"" if has_diff else None
    )


@pytest.mark.asyncio
async def test_branch_name_convention():
    """Branch names must follow: sentraai/fix/<rule-slug>-<scan_prefix>"""
    name = _build_branch_name("AWS_S3_PUBLIC", "5cfa5820-abcd-1234-5678-deadbeefcafe")
    assert name.startswith("sentraai/fix/aws-s3-public-")
    assert len(name) < 60  # Reasonable length for GitHub branch names


@pytest.mark.asyncio
async def test_pr_fingerprint_is_deterministic():
    """Same inputs must always produce the same fingerprint."""
    fp1 = compute_pr_fingerprint("AWS_S3_PUBLIC", "main.tf", "diff content here")
    fp2 = compute_pr_fingerprint("AWS_S3_PUBLIC", "main.tf", "diff content here")
    assert fp1 == fp2
    assert len(fp1) == 16


@pytest.mark.asyncio
async def test_pr_fingerprint_changes_on_different_diff():
    """Different diffs must produce different fingerprints (drift detection signal)."""
    fp1 = compute_pr_fingerprint("AWS_S3_PUBLIC", "main.tf", "diff version 1")
    fp2 = compute_pr_fingerprint("AWS_S3_PUBLIC", "main.tf", "diff version 2")
    assert fp1 != fp2


@pytest.mark.asyncio
async def test_source_content_hash_is_deterministic():
    """Source content hash must be stable for the same content."""
    h1 = compute_source_content_hash('resource "aws_s3_bucket" "x" { acl = "public-read" }')
    h2 = compute_source_content_hash('resource "aws_s3_bucket" "x" { acl = "public-read" }')
    assert h1 == h2


@pytest.mark.asyncio
@patch("backend.app.services.autofix_service.check_autofix_cooldown", return_value=False)
@patch("backend.app.services.autofix_service.save_autofix_pr_record")
@patch("backend.app.services.autofix_service.remediation_registry")
async def test_autofix_skips_ineligible_findings(
    mock_registry, mock_save, mock_cooldown
):
    """
    Findings without safe_for_autofix=True must be completely skipped.
    IAM wildcard findings must NEVER trigger branch creation.
    """
    mock_provider = AsyncMock()
    mock_provider.get_default_branch.return_value = "main"

    # One safe finding, one IAM finding (never auto-fixable)
    findings = [
        make_finding("AWS_IAM_WILDCARD", safe_for_autofix=False,
                     fix_safety_tier=FixSafetyTier.NONE, requires_human_review=True),
        make_finding("AWS_IAM_WILDCARD", safe_for_autofix=False, has_diff=False),
    ]

    results = await run_autofix_workflows(
        git_provider=mock_provider,
        repo_full_name="test-org/test-repo",
        base_sha="abc123sha",
        scan_id="test-scan-id",
        original_pr_number=42,
        findings=findings
    )

    # No branches should be created for ineligible findings
    mock_provider.create_branch.assert_not_called()
    mock_provider.create_pull_request.assert_not_called()
    assert results == []


@pytest.mark.asyncio
@patch("backend.app.services.autofix_service.check_autofix_cooldown", return_value=False)
@patch("backend.app.services.autofix_service.save_autofix_pr_record")
@patch("backend.app.services.autofix_service.remediation_registry")
async def test_autofix_cooldown_skips_pr(mock_registry, mock_save, mock_cooldown):
    """
    When cooldown is active, autofix must skip without creating any branch or PR.
    """
    mock_cooldown.return_value = True  # Cooldown active
    mock_provider = AsyncMock()
    mock_provider.get_default_branch.return_value = "main"

    findings = [make_finding("AWS_S3_PUBLIC")]

    results = await run_autofix_workflows(
        git_provider=mock_provider,
        repo_full_name="test-org/test-repo",
        base_sha="abc123sha",
        scan_id="test-scan-id",
        original_pr_number=42,
        findings=findings
    )

    assert len(results) == 1
    assert results[0]["status"] == "COOLDOWN_SKIPPED"
    mock_provider.create_branch.assert_not_called()
    mock_provider.create_pull_request.assert_not_called()


@pytest.mark.asyncio
@patch("backend.app.services.autofix_service.check_autofix_cooldown", return_value=False)
@patch("backend.app.services.autofix_service.save_autofix_pr_record")
@patch("backend.app.services.autofix_service.remediation_registry")
async def test_autofix_duplicate_pr_protection(mock_registry, mock_save, mock_cooldown):
    """
    When an open PR already exists for the same branch, no new PR should be created.
    """
    mock_provider = AsyncMock()
    mock_provider.get_default_branch.return_value = "main"
    mock_provider.get_file_content.return_value = 'resource "aws_s3_bucket" "x" { acl = "public-read" }'
    mock_provider.find_open_pr_for_branch.return_value = 99  # Existing PR found

    # Mock remediation registry so drift detection succeeds
    mock_registry.get_remediation_in_memory.return_value = {
        "remediation_diff": "--- a/main.tf\n+++ b/main.tf\n@@ -1 +1 @@\n- acl = \"public-read\"\n+ acl = \"private\"",
        "validation_status": "SUCCESS"
    }

    findings = [make_finding("AWS_S3_PUBLIC")]

    results = await run_autofix_workflows(
        git_provider=mock_provider,
        repo_full_name="test-org/test-repo",
        base_sha="abc123sha",
        scan_id="test-scan-id",
        original_pr_number=42,
        findings=findings
    )

    assert len(results) == 1
    assert results[0]["status"] == "DUPLICATE_SKIPPED"
    mock_provider.create_branch.assert_not_called()
    mock_provider.create_pull_request.assert_not_called()


@pytest.mark.asyncio
@patch("backend.app.services.autofix_service.check_autofix_cooldown", return_value=False)
@patch("backend.app.services.autofix_service.save_autofix_pr_record")
@patch("backend.app.services.autofix_service.remediation_registry")
@patch("backend.app.services.autofix_service._extract_fixed_content", return_value='resource "aws_s3_bucket" "test_resource" {\n  acl = "private"\n}\n')
async def test_autofix_pr_created_for_safe_finding(mock_extract, mock_registry, mock_save, mock_cooldown):
    """
    Happy path: a SAFE tier finding with a valid diff should trigger branch + PR creation.
    """
    mock_provider = AsyncMock()
    mock_provider.get_default_branch.return_value = "main"
    mock_provider.get_file_content.return_value = 'resource "aws_s3_bucket" "test_resource" {\n  acl = "public-read"\n}\n'
    mock_provider.find_open_pr_for_branch.return_value = None  # No existing PR
    mock_provider.create_branch.return_value = True
    mock_provider.commit_file.return_value = True
    mock_provider.create_pull_request.return_value = "https://github.com/test-org/test-repo/pull/101"

    # Mock remediation registry so drift detection + fix generation succeeds
    mock_registry.get_remediation_in_memory.return_value = {
        "remediation_diff": "--- a/main.tf\n+++ b/main.tf\n@@ -1 +1 @@\n- acl = \"public-read\"\n+ acl = \"private\"",
        "validation_status": "SUCCESS"
    }

    findings = [make_finding("AWS_S3_PUBLIC")]

    results = await run_autofix_workflows(
        git_provider=mock_provider,
        repo_full_name="test-org/test-repo",
        base_sha="abc123sha",
        scan_id="test-scan-id",
        original_pr_number=42,
        findings=findings
    )

    # Must have attempted exactly one branch and one PR
    mock_provider.create_branch.assert_called_once()
    mock_provider.create_pull_request.assert_called_once()

    # Verify labels were passed
    call_kwargs = mock_provider.create_pull_request.call_args
    labels = call_kwargs[1].get("labels") or call_kwargs[0][5]
    assert "sentraai" in labels
    assert "security-fix" in labels
    assert "auto-remediation" in labels

    # Verify branch naming convention
    branch_arg = mock_provider.create_branch.call_args[0][1]
    assert branch_arg.startswith("sentraai/fix/aws-s3-public-")

    # Verify PR was recorded as CREATED
    mock_save.assert_called()
    saved_call = mock_save.call_args[1]
    assert saved_call["status"] == "CREATED"
    assert saved_call["rule_id"] == "AWS_S3_PUBLIC"


@pytest.mark.asyncio
@patch("backend.app.services.autofix_service.check_autofix_cooldown", return_value=False)
@patch("backend.app.services.autofix_service.save_autofix_pr_record")
async def test_autofix_pr_body_contains_required_sections(mock_save, mock_cooldown):
    """PR body must contain all trust-critical sections."""
    from backend.app.services.autofix_pr_service import build_autofix_pr_body
    from remediation_engine.autofix_policy import get_autofix_policy

    finding = make_finding("AWS_S3_PUBLIC")
    policy = get_autofix_policy("AWS_S3_PUBLIC")
    body = build_autofix_pr_body(
        finding=finding,
        policy=policy,
        scan_id="scan-test-123",
        original_pr_number=42,
        pr_fingerprint="abcd1234ef567890"
    )

    # Check all required sections are present
    assert "AWS_S3_PUBLIC" in body
    assert "Why This PR Was Generated" in body
    assert "Fix Applied" in body
    assert "If This Fix Is Not Appropriate" in body         # Suppression guidance
    assert "sentra-ignore" in body
    assert "Rollback" in body                               # Rollback guidance
    assert "scan-test-123" in body                          # Trace ID
    assert "abcd1234ef567890" in body                       # PR Fingerprint
    assert "SentraAI-Fingerprint:" in body                  # HTML comment fingerprint
    assert "SentraAI Autofix Engine" in body                # Automation identity in footer
    assert "Never auto-merge" in body                       # Safety warning

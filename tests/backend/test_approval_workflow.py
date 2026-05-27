import os
import sys
import uuid
import hashlib
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta
import pytest

# Ensure parent directory is in path
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
backend_dir = os.path.join(parent_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app
from app.security.signature_validator import verify_signature
from fastapi.testclient import TestClient
from app.database.db_client import run_migrations, get_connection
from app.database.telemetry_dao import save_autofix_pr_record
from app.services.autofix_service import _build_branch_name
from scanner_engine.parsers.tf_parser import parse_tf_string
from scanner_engine.rule_registry import registry
from remediation_engine.remediation_registry import remediation_registry

# Override signature verification for testing
app.dependency_overrides[verify_signature] = lambda: None
client = TestClient(app)

# Ensure migrations are run so database schema is up-to-date
run_migrations()


def _get_aws_s3_public_preview_hash() -> str:
    """Helper to dynamically generate the correct preview hash from the engine."""
    file_content = (
        'resource "aws_s3_bucket" "test_bucket" {\n'
        '  bucket = "my-test-bucket-name"\n'
        '  acl    = "public-read"\n'
        '}\n'
    )
    rule = next((r for r in registry.get_all_rules() if r.id == "AWS_S3_PUBLIC"), None)
    assert rule is not None
    parsed_data = parse_tf_string(file_content)
    findings = rule.check(parsed_data, "main.tf")
    finding = findings[0]
    remediation = remediation_registry.get_remediation_in_memory(
        "AWS_S3_PUBLIC", "main.tf", finding.resource_type, finding.resource_name, file_content
    )
    diff = remediation["remediation_diff"]
    return hashlib.sha256(diff.strip().encode("utf-8")).hexdigest()


def _extract_reply_body(mock_call) -> str:
    """Helper to extract body parameter regardless of positional or keyword argument style."""
    args = mock_call.call_args[0]
    kwargs = mock_call.call_args[1]
    return kwargs.get("body") or (args[3] if len(args) > 3 else "")


@patch("app.services.webhook_service.GitHubProvider")
def test_unauthorized_user_approval_flow(mock_provider_class):
    """
    Tests that if a comment is created by an unauthorized user (association = NONE),
    the webhook rejects the request, posts an authorization warning reply,
    and logs the rejection audit to the database.
    """
    mock_provider = AsyncMock()
    mock_provider.find_open_pr_for_branch.return_value = None
    mock_provider_class.return_value = mock_provider

    repo_name = f"test-owner/test-repo-{uuid.uuid4()}"

    payload = {
        "action": "created",
        "comment": {
            "id": 11111,
            "body": "/approve",
            "author_association": "NONE",
            "in_reply_to_id": 99999,
            "user": {"login": "malicious_actor"},
            "commit_id": "mocked-git-head-sha",
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        },
        "repository": {"full_name": repo_name},
        "pull_request": {
            "number": 42,
            "head": {"sha": "mocked-git-head-sha"}
        },
        "installation": {"id": 998877}
    }

    headers = {
        "X-GitHub-Event": "pull_request_review_comment",
        "X-GitHub-Delivery": f"mock-delivery-{uuid.uuid4()}"
    }

    response = client.post("/webhook", json=payload, headers=headers)
    assert response.status_code == 202

    # Assert reply comment warning is posted
    mock_provider.post_pull_request_comment_reply.assert_called_once()
    reply_body = _extract_reply_body(mock_provider.post_pull_request_comment_reply)
    assert "Authorization Warning" in reply_body

    # Verify audit log in DB
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM approval_audit_logs WHERE actor = ? AND repo_name = ? ORDER BY id DESC LIMIT 1", ("malicious_actor", repo_name))
        row = cursor.fetchone()
        assert row is not None
        assert row["status"] == "REJECTED"
        assert "malicious_actor" in row["actor"]
    finally:
        conn.close()


@patch("app.services.webhook_service.GitHubProvider")
def test_successful_approval_flow(mock_provider_class):
    """
    Tests that a valid approval by an authorized collaborator:
    1. Fetches parent comment metadata and file contents.
    2. Runs validation successfully (syntax, CLI, boundary).
    3. Triggers PR creation.
    4. Posts success confirmation with PR URL.
    5. Saves APPROVED audit log.
    """
    mock_provider = AsyncMock()
    mock_provider.find_open_pr_for_branch.return_value = None
    mock_provider_class.return_value = mock_provider

    repo_name = f"test-owner/test-repo-{uuid.uuid4()}"
    preview_hash = _get_aws_s3_public_preview_hash()
    scan_id = str(uuid.uuid4())

    # Parent comment mock return
    parent_comment = {
        "id": 99999,
        "body": f"🚨 CRITICAL Security Finding\nRule: `AWS_S3_PUBLIC`<!-- SentraAI-RuleID: AWS_S3_PUBLIC -->\n<!-- SentraAI-FilePath: main.tf -->\n<!-- SentraAI-LineNumber: 1 -->\n<!-- SentraAI-ScanID: {scan_id} -->\n<!-- SentraAI-PreviewHash: {preview_hash} -->",
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    }
    mock_provider.get_single_pull_request_comment.return_value = parent_comment

    # Mock file contents at commit
    mock_provider.get_file_content.return_value = (
        'resource "aws_s3_bucket" "test_bucket" {\n'
        '  bucket = "my-test-bucket-name"\n'
        '  acl    = "public-read"\n'
        '}\n'
    )

    mock_provider.get_default_branch.return_value = "main"
    mock_provider.create_branch.return_value = True
    mock_provider.commit_file.return_value = True
    mock_provider.create_pull_request.return_value = f"https://github.com/{repo_name}/pull/101"

    payload = {
        "action": "created",
        "comment": {
            "id": 22222,
            "body": "/approve",
            "author_association": "COLLABORATOR",
            "in_reply_to_id": 99999,
            "user": {"login": "AryanGupta"},
            "commit_id": "mocked-git-head-sha",
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        },
        "repository": {"full_name": repo_name},
        "pull_request": {
            "number": 42,
            "head": {"sha": "mocked-git-head-sha"}
        },
        "installation": {"id": 998877}
    }

    headers = {
        "X-GitHub-Event": "pull_request_review_comment",
        "X-GitHub-Delivery": f"mock-delivery-{uuid.uuid4()}"
    }

    response = client.post("/webhook", json=payload, headers=headers)
    assert response.status_code == 202

    # Verify that PR creation was called
    mock_provider.create_pull_request.assert_called_once()

    # Verify reply comment contains PR URL
    mock_provider.post_pull_request_comment_reply.assert_called_once()
    reply_body = _extract_reply_body(mock_provider.post_pull_request_comment_reply)
    assert "PR Created" in reply_body or "PR URL" in reply_body or "remediation pull request" in reply_body
    assert f"https://github.com/{repo_name}/pull/101" in reply_body

    # Verify APPROVED audit log in DB
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM approval_audit_logs WHERE actor = ? AND repo_name = ? ORDER BY id DESC LIMIT 1", ("AryanGupta", repo_name))
        row = cursor.fetchone()
        assert row is not None
        assert row["status"] == "APPROVED"
        assert row["pr_url"] == f"https://github.com/{repo_name}/pull/101"
        assert row["finding_id"] == "AWS_S3_PUBLIC"
    finally:
        conn.close()


@patch("app.services.webhook_service.GitHubProvider")
def test_drift_detected_approval_flow(mock_provider_class):
    """
    Tests that if the code has drifted and the generated remediation diff does not match
    the original preview hash inside the parent comment, the approval is rejected.
    """
    mock_provider = AsyncMock()
    mock_provider.find_open_pr_for_branch.return_value = None
    mock_provider_class.return_value = mock_provider

    repo_name = f"test-owner/test-repo-{uuid.uuid4()}"
    scan_id = str(uuid.uuid4())
    # Parent comment uses an incorrect preview hash to simulate code drift
    parent_comment = {
        "id": 99999,
        "body": f"🚨 CRITICAL Security Finding\nRule: `AWS_S3_PUBLIC`<!-- SentraAI-RuleID: AWS_S3_PUBLIC -->\n<!-- SentraAI-FilePath: main.tf -->\n<!-- SentraAI-LineNumber: 1 -->\n<!-- SentraAI-ScanID: {scan_id} -->\n<!-- SentraAI-PreviewHash: deadbeef1234567890 -->",
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    }
    mock_provider.get_single_pull_request_comment.return_value = parent_comment

    # File contents at commit (still vulnerable but diff hash won't match deadbeef)
    mock_provider.get_file_content.return_value = (
        'resource "aws_s3_bucket" "test_bucket" {\n'
        '  bucket = "my-test-bucket-name"\n'
        '  acl    = "public-read"\n'
        '}\n'
    )

    payload = {
        "action": "created",
        "comment": {
            "id": 33333,
            "body": "/approve",
            "author_association": "OWNER",
            "in_reply_to_id": 99999,
            "user": {"login": "AryanGupta"},
            "commit_id": "mocked-git-head-sha",
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        },
        "repository": {"full_name": repo_name},
        "pull_request": {
            "number": 42,
            "head": {"sha": "mocked-git-head-sha"}
        },
        "installation": {"id": 998877}
    }

    headers = {
        "X-GitHub-Event": "pull_request_review_comment",
        "X-GitHub-Delivery": f"mock-delivery-{uuid.uuid4()}"
    }

    response = client.post("/webhook", json=payload, headers=headers)
    assert response.status_code == 202

    # Ensure PR creation was NOT called
    mock_provider.create_pull_request.assert_not_called()

    # Verify reply comment informs user of code drift
    mock_provider.post_pull_request_comment_reply.assert_called_once()
    reply_body = _extract_reply_body(mock_provider.post_pull_request_comment_reply)
    assert "Code drift detected" in reply_body

    # Verify audit log in DB shows FAILED with drift reason
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM approval_audit_logs WHERE actor = ? AND repo_name = ? ORDER BY id DESC LIMIT 1", ("AryanGupta", repo_name))
        row = cursor.fetchone()
        assert row is not None
        assert row["status"] == "FAILED"
        assert "drift" in row["failure_reason"].lower()
    finally:
        conn.close()


@patch("app.services.webhook_service.GitHubProvider")
def test_duplicate_pr_approval_flow(mock_provider_class):
    """
    Tests that if a remediation PR has already been created for this finding
    (verified by DB record or open PR in GitHub), we return a graceful reply
    pointing to the existing PR and record DUPLICATE status in the audit log.
    """
    mock_provider = AsyncMock()
    mock_provider.find_open_pr_for_branch.return_value = None
    mock_provider_class.return_value = mock_provider

    repo_name = f"test-owner/test-repo-{uuid.uuid4()}"
    preview_hash = _get_aws_s3_public_preview_hash()
    scan_id = str(uuid.uuid4())

    parent_comment = {
        "id": 99999,
        "body": f"🚨 CRITICAL Security Finding\nRule: `AWS_S3_PUBLIC`<!-- SentraAI-RuleID: AWS_S3_PUBLIC -->\n<!-- SentraAI-FilePath: main.tf -->\n<!-- SentraAI-LineNumber: 1 -->\n<!-- SentraAI-ScanID: {scan_id} -->\n<!-- SentraAI-PreviewHash: {preview_hash} -->",
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    }
    mock_provider.get_single_pull_request_comment.return_value = parent_comment

    # Save duplicate record to database to trigger idempotency check
    branch_name = _build_branch_name("AWS_S3_PUBLIC", scan_id)
    save_autofix_pr_record(
        scan_id=scan_id,
        repo_name=repo_name,
        rule_id="AWS_S3_PUBLIC",
        file_path="main.tf",
        branch_name=branch_name,
        fix_safety_tier="SAFE",
        status="CREATED",
        pr_url=f"https://github.com/{repo_name}/pull/101"
    )

    payload = {
        "action": "created",
        "comment": {
            "id": 44444,
            "body": "/approve",
            "author_association": "MEMBER",
            "in_reply_to_id": 99999,
            "user": {"login": "AryanGupta"},
            "commit_id": "mocked-git-head-sha",
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        },
        "repository": {"full_name": repo_name},
        "pull_request": {
            "number": 42,
            "head": {"sha": "mocked-git-head-sha"}
        },
        "installation": {"id": 998877}
    }

    headers = {
        "X-GitHub-Event": "pull_request_review_comment",
        "X-GitHub-Delivery": f"mock-delivery-{uuid.uuid4()}"
    }

    response = client.post("/webhook", json=payload, headers=headers)
    assert response.status_code == 202

    # Ensure PR creation was NOT called since it already exists
    mock_provider.create_pull_request.assert_not_called()

    # Verify reply comment indicates existing PR URL
    mock_provider.post_pull_request_comment_reply.assert_called_once()
    reply_body = _extract_reply_body(mock_provider.post_pull_request_comment_reply)
    assert "PR already exists" in reply_body
    assert f"https://github.com/{repo_name}/pull/101" in reply_body

    # Verify DUPLICATE audit log in DB
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM approval_audit_logs WHERE actor = ? AND repo_name = ? ORDER BY id DESC LIMIT 1", ("AryanGupta", repo_name))
        row = cursor.fetchone()
        assert row is not None
        assert row["status"] == "DUPLICATE"
        assert row["pr_url"] == f"https://github.com/{repo_name}/pull/101"
    finally:
        conn.close()


@patch("app.services.webhook_service.GitHubProvider")
def test_expired_approval_flow(mock_provider_class):
    """
    Tests that if the parent security comment was created more than 24 hours ago,
    the GitOps approval action is rejected and logged as EXPIRED.
    """
    mock_provider = AsyncMock()
    mock_provider.find_open_pr_for_branch.return_value = None
    mock_provider_class.return_value = mock_provider

    repo_name = f"test-owner/test-repo-{uuid.uuid4()}"
    preview_hash = _get_aws_s3_public_preview_hash()
    scan_id = str(uuid.uuid4())

    # Parent comment is 25 hours old (expired)
    expired_time = datetime.now(timezone.utc) - timedelta(hours=25)
    parent_comment = {
        "id": 99999,
        "body": f"🚨 CRITICAL Security Finding\nRule: `AWS_S3_PUBLIC`<!-- SentraAI-RuleID: AWS_S3_PUBLIC -->\n<!-- SentraAI-FilePath: main.tf -->\n<!-- SentraAI-LineNumber: 1 -->\n<!-- SentraAI-ScanID: {scan_id} -->\n<!-- SentraAI-PreviewHash: {preview_hash} -->",
        "created_at": expired_time.isoformat().replace("+00:00", "Z")
    }
    mock_provider.get_single_pull_request_comment.return_value = parent_comment

    payload = {
        "action": "created",
        "comment": {
            "id": 55555,
            "body": "/approve",
            "author_association": "OWNER",
            "in_reply_to_id": 99999,
            "user": {"login": "AryanGupta"},
            "commit_id": "mocked-git-head-sha",
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        },
        "repository": {"full_name": repo_name},
        "pull_request": {
            "number": 42,
            "head": {"sha": "mocked-git-head-sha"}
        },
        "installation": {"id": 998877}
    }

    headers = {
        "X-GitHub-Event": "pull_request_review_comment",
        "X-GitHub-Delivery": f"mock-delivery-{uuid.uuid4()}"
    }

    response = client.post("/webhook", json=payload, headers=headers)
    assert response.status_code == 202

    # Ensure PR creation was NOT called
    mock_provider.create_pull_request.assert_not_called()

    # Verify reply comment informs user of comment expiration
    mock_provider.post_pull_request_comment_reply.assert_called_once()
    reply_body = _extract_reply_body(mock_provider.post_pull_request_comment_reply)
    assert "comment has expired" in reply_body

    # Verify EXPIRED audit log in DB
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM approval_audit_logs WHERE actor = ? AND repo_name = ? ORDER BY id DESC LIMIT 1", ("AryanGupta", repo_name))
        row = cursor.fetchone()
        assert row is not None
        assert row["status"] == "EXPIRED"
        assert "exceeds limit" in row["failure_reason"].lower()
    finally:
        conn.close()

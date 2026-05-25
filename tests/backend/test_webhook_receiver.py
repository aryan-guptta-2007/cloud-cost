import os
import sys
import json
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

# Ensure parent directory is in sys.path for monorepo imports
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from backend.app.main import app
from shared.constants.comment_signature import COMMENT_SIGNATURE

client = TestClient(app)

@patch("backend.app.services.webhook_service.GitHubProvider")
def test_webhook_pull_request_flow(mock_provider_class):
    """
    Tests that a valid pull_request webhook:
    1. Triggers the scanner endpoint and returns 202 Accepted.
    2. Runs BackgroundTasks synchronously (in TestClient) to scan the PR changes.
    3. Fetches only *.tf/*.tfvars files from provider.
    4. Downloads raw contents in-memory.
    5. Formats and posts a consolidated review comment to the PR.
    """
    # 1. Setup Mock Provider instance
    mock_provider = AsyncMock()
    mock_provider_class.return_value = mock_provider
    
    # Mock files in PR (2 tf configs, 1 markdown file)
    mock_provider.get_pr_files.return_value = [
        {"filename": "main.tf", "status": "modified"},
        {"filename": "variables.tf", "status": "modified"},
        {"filename": "README.md", "status": "modified"}  # Ignore due to file type filter
    ]
    
    # Mock download file strings using standard multi-line configuration styles
    def mock_get_content(repo, path, sha):
        if path == "main.tf":
            return (
                'resource "aws_s3_bucket" "test_bucket" {\n'
                '  bucket = "my-test-bucket-name"\n'
                '  acl    = "public-read"\n'
                '}\n'
            )
        elif path == "variables.tf":
            return (
                'resource "aws_db_instance" "test_db" {\n'
                '  instance_class    = "db.t3.micro"\n'
                '  storage_encrypted = false\n'
                '}\n'
            )
        return ""
        
    mock_provider.get_file_content.side_effect = mock_get_content

    # 2. Trigger webhook endpoint with mock payload
    payload = {
        "action": "opened",
        "number": 42,
        "repository": {"full_name": "test-owner/test-repo"},
        "installation": {"id": 998877},
        "pull_request": {
            "head": {"sha": "mocked-git-head-sha"}
        }
    }
    
    headers = {
        "X-GitHub-Event": "pull_request",
        "X-GitHub-Delivery": "mock-delivery-id-777"
    }

    response = client.post("/webhook", json=payload, headers=headers)

    # 3. Assert Response and Background Processing
    assert response.status_code == 202
    assert response.json()["message"] == "Webhook payload accepted. Processing scheduled."

    # Validate that GitHubProvider was initialized with correct installation ID
    mock_provider_class.assert_called_once_with(998877)

    # Validate that changed files list was fetched
    mock_provider.get_pr_files.assert_called_once_with("test-owner/test-repo", 42, "mocked-git-head-sha")

    # Validate that only *.tf files content was downloaded in-memory
    mock_provider.get_file_content.assert_any_call("test-owner/test-repo", "main.tf", "mocked-git-head-sha")
    mock_provider.get_file_content.assert_any_call("test-owner/test-repo", "variables.tf", "mocked-git-head-sha")
    
    # Ensure non-tf files (README.md) were completely skipped
    for call in mock_provider.get_file_content.call_args_list:
        assert "README.md" not in call[0]

    # Validate comment was posted / updated
    mock_provider.post_or_update_pr_comment.assert_called_once()
    
    # Extract comment contents
    call_args = mock_provider.post_or_update_pr_comment.call_args[0]
    assert call_args[0] == "test-owner/test-repo"
    assert call_args[1] == 42
    
    comment_body = call_args[2]
    # Check comment signature and findings mapping inside PR comment
    assert comment_body.startswith(COMMENT_SIGNATURE)
    assert "AWS_S3_PUBLIC" in comment_body
    assert "AWS_DB_UNENCRYPTED" in comment_body
    assert 'acl = "private"' in comment_body
    assert "storage_encrypted = true" in comment_body
    assert "Execution Metrics" in comment_body
    assert "Trace ID" in comment_body

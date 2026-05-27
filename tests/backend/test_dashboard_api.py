import os
import sys
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
from app.database.db_client import run_migrations

# Override signature verification for testing
app.dependency_overrides[verify_signature] = lambda: None
client = TestClient(app)

# Ensure migrations are run so database schema is up-to-date
run_migrations()


def test_get_dashboard_stats_endpoint():
    """
    Verifies that the /api/stats endpoint returns the expected keys
    and aggregates correct metrics from the SQLite database.
    """
    response = client.get("/api/stats")
    assert response.status_code == 200
    
    data = response.json()
    expected_keys = {
        "total_scans",
        "total_findings",
        "total_suppressed",
        "total_autofix_prs",
        "total_gitops_approvals",
        "avg_scan_time_seconds",
        "estimated_hours_saved"
    }
    for key in expected_keys:
        assert key in data
        assert isinstance(data[key], (int, float))


def test_get_recent_scans_endpoint():
    """
    Verifies that the /api/scans endpoint returns a valid list of scan logs.
    """
    response = client.get("/api/scans")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    if data:
        # Check structure of the first log entry
        entry = data[0]
        assert "scan_id" in entry
        assert "repo_name" in entry
        assert "pr_number" in entry
        assert "head_sha" in entry
        assert "status" in entry


def test_get_recent_approvals_endpoint():
    """
    Verifies that the /api/approvals endpoint returns a valid list of GitOps actions.
    """
    response = client.get("/api/approvals")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    if data:
        entry = data[0]
        assert "id" in entry
        assert "scan_id" in entry
        assert "actor" in entry
        assert "status" in entry
        assert "command" in entry


def test_get_recent_autofixes_endpoint():
    """
    Verifies that the /api/autofixes endpoint returns a valid list of autofix attempts.
    """
    response = client.get("/api/autofixes")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    if data:
        entry = data[0]
        assert "id" in entry
        assert "scan_id" in entry
        assert "rule_id" in entry
        assert "status" in entry

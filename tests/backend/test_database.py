import os
import sys
import sqlite3
import pytest

# Ensure parent directory is in path
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from backend.app.database.db_client import run_migrations, get_connection, DB_PATH
from backend.app.database.telemetry_dao import (
    register_delivery_id,
    save_scan_telemetry,
    save_suppression_audit
)

def test_database_migrations_and_dao():
    """
    Verifies that the database runs versioned migrations, enforces primary key constraints
    for webhook delivery deduplication, and records both telemetry and suppression audit rows.
    """
    # 1. Initialize schema migrations (idempotent)
    run_migrations()

    # Assert DB file has been created
    assert os.path.exists(DB_PATH)

    # 2. Test Webhook delivery idempotency checks
    delivery_id = "test-delivery-id-uuid-555"

    # First write should succeed
    assert register_delivery_id(delivery_id) is True
    # Second write of the same ID should fail (deduplicated)
    assert register_delivery_id(delivery_id) is False

    # 3. Test Telemetry insertion
    scan_id = "test-scan-id-uuid-888"
    save_scan_telemetry(
        scan_id=scan_id,
        repo_name="test-org/test-repo",
        pr_number=10,
        head_sha="mock-commit-sha",
        status="COMPLETED",
        findings_count=3,
        suppressed_count=2,
        parse_time=0.005,
        scan_time=0.010,
        remediation_time=0.015,
        total_time=0.030
    )

    # 4. Test Suppression Audit telemetry insertion (Migration v2)
    suppressed_findings = [
        {
            "rule_id": "AWS_S3_PUBLIC",
            "resource": "aws_s3_bucket.my_cdn_bucket",
            "reason": "public CDN bucket required for static assets",
            "severity": "HIGH",
            "file_path": "main.tf"
        },
        {
            "rule_id": "AWS_IAM_WILDCARD",
            "resource": "aws_iam_policy.legacy_policy",
            "reason": "legacy system — manual review scheduled for Q3",
            "severity": "CRITICAL",
            "file_path": "iam.tf"
        }
    ]
    save_suppression_audit(
        scan_id=scan_id,
        repo_name="test-org/test-repo",
        suppressed_findings=suppressed_findings
    )

    # 5. Verify SQL query content
    conn = get_connection()
    try:
        cursor = conn.cursor()

        # Assert delivery is cached
        cursor.execute("SELECT * FROM webhook_deliveries WHERE delivery_id = ?", (delivery_id,))
        del_row = cursor.fetchone()
        assert del_row is not None
        assert del_row["delivery_id"] == delivery_id

        # Assert telemetry details are stored
        cursor.execute("SELECT * FROM scan_telemetry WHERE scan_id = ?", (scan_id,))
        tel_row = cursor.fetchone()
        assert tel_row is not None
        assert tel_row["repo_name"] == "test-org/test-repo"
        assert tel_row["pr_number"] == 10
        assert tel_row["head_sha"] == "mock-commit-sha"
        assert tel_row["findings_count"] == 3
        assert tel_row["suppressed_count"] == 2
        assert tel_row["total_time"] == 0.030

        # Assert suppression audit rows written (Migration v2)
        cursor.execute(
            "SELECT * FROM suppression_audit WHERE scan_id = ? ORDER BY id ASC",
            (scan_id,)
        )
        audit_rows = cursor.fetchall()
        assert len(audit_rows) == 2

        # Verify first audit row
        assert audit_rows[0]["rule_id"] == "AWS_S3_PUBLIC"
        assert audit_rows[0]["resource_key"] == "aws_s3_bucket.my_cdn_bucket"
        assert "CDN" in audit_rows[0]["reason"]

        # Verify second audit row
        assert audit_rows[1]["rule_id"] == "AWS_IAM_WILDCARD"
        assert audit_rows[1]["resource_key"] == "aws_iam_policy.legacy_policy"

        # Verify schema_migrations version reflects both migrations applied
        cursor.execute("SELECT MAX(version) FROM schema_migrations")
        schema_version = cursor.fetchone()[0]
        assert schema_version >= 2, f"Expected schema version >= 2, got {schema_version}"

    finally:
        conn.close()

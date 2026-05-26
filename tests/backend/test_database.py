import os
import sys
import sqlite3
import pytest
import uuid

# Ensure parent directory is in path
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from backend.app.database.db_client import run_migrations, get_connection, DB_PATH
from backend.app.database.telemetry_dao import (
    register_delivery_id,
    save_scan_telemetry,
    save_suppression_audit,
    save_autofix_pr_record,
    check_autofix_cooldown,
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
    delivery_id = f"test-delivery-id-uuid-{uuid.uuid4()}"

    # First write should succeed
    assert register_delivery_id(delivery_id) is True
    # Second write of the same ID should fail (deduplicated)
    assert register_delivery_id(delivery_id) is False

    # 3. Test Telemetry insertion
    scan_id = f"test-scan-id-uuid-{uuid.uuid4()}"
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
        assert audit_rows[0]["rule_id"] == "AWS_S3_PUBLIC"
        assert audit_rows[0]["resource_key"] == "aws_s3_bucket.my_cdn_bucket"
        assert "CDN" in audit_rows[0]["reason"]
        assert audit_rows[1]["rule_id"] == "AWS_IAM_WILDCARD"
        assert audit_rows[1]["resource_key"] == "aws_iam_policy.legacy_policy"

        # 6. Test Migration v3 — autofix_prs table
        autofix_scan_id = f"test-autofix-scan-{uuid.uuid4()}"
        dynamic_repo = f"test-org/test-repo-{uuid.uuid4()}"
        dynamic_file = f"infra/main-{uuid.uuid4()}.tf"
        dynamic_branch = f"sentraai/fix/aws-s3-public-{uuid.uuid4()}"

        save_autofix_pr_record(
            scan_id=autofix_scan_id,
            repo_name=dynamic_repo,
            rule_id="AWS_S3_PUBLIC",
            file_path=dynamic_file,
            branch_name=dynamic_branch,
            fix_safety_tier="SAFE",
            status="CREATED",
            pr_url="https://github.com/test-org/test-repo/pull/101",
            pr_number=101,
            pr_fingerprint="abcd1234ef567890",
            source_content_hash="sha256deadbeef",
            failure_reason=None
        )

        # Assert autofix PR record written
        cursor.execute("SELECT * FROM autofix_prs WHERE scan_id = ?", (autofix_scan_id,))
        autofix_row = cursor.fetchone()
        assert autofix_row is not None
        assert autofix_row["rule_id"] == "AWS_S3_PUBLIC"
        assert autofix_row["file_path"] == dynamic_file
        assert autofix_row["branch_name"] == dynamic_branch
        assert autofix_row["status"] == "CREATED"
        assert autofix_row["pr_number"] == 101
        assert autofix_row["pr_fingerprint"] == "abcd1234ef567890"
        assert autofix_row["source_content_hash"] == "sha256deadbeef"
        assert autofix_row["fix_safety_tier"] == "SAFE"

        # 7. Test Cooldown enforcement
        # The CREATED record above should trigger cooldown for same repo+rule+file
        is_cooling = check_autofix_cooldown(dynamic_repo, "AWS_S3_PUBLIC", dynamic_file)
        assert is_cooling is True, "Cooldown should be active within 24h of CREATED status"

        # Different file should NOT be in cooldown
        different_file_cooldown = check_autofix_cooldown(dynamic_repo, "AWS_S3_PUBLIC", f"other/{dynamic_file}")
        assert different_file_cooldown is False, "Cooldown should not apply to different files"

        # Different rule should NOT be in cooldown
        different_rule_cooldown = check_autofix_cooldown(dynamic_repo, "AWS_DB_UNENCRYPTED", dynamic_file)
        assert different_rule_cooldown is False, "Cooldown should not apply to different rules"


        # 8. Test all valid lifecycle status values can be written
        for lifecycle_status in ["FAILED", "DUPLICATE_SKIPPED", "COOLDOWN_SKIPPED", "MERGED", "CLOSED", "STALE"]:
            save_autofix_pr_record(
                scan_id=f"test-{lifecycle_status.lower()}",
                repo_name="test-org/test-repo",
                rule_id="AWS_DB_UNENCRYPTED",
                file_path="db.tf",
                branch_name=f"sentraai/fix/aws-db-unencrypted-{lifecycle_status.lower()}",
                fix_safety_tier="SAFE",
                status=lifecycle_status,
                failure_reason=f"Test {lifecycle_status}" if lifecycle_status == "FAILED" else None
            )

        cursor.execute("SELECT COUNT(*) FROM autofix_prs WHERE repo_name = 'test-org/test-repo'")
        total_autofix_records = cursor.fetchone()[0]
        assert total_autofix_records >= 7  # 1 CREATED + 6 lifecycle statuses

        # 9. Verify schema_migrations version reflects all 3 migrations
        cursor.execute("SELECT MAX(version) FROM schema_migrations")
        schema_version = cursor.fetchone()[0]
        assert schema_version >= 3, f"Expected schema version >= 3, got {schema_version}"

    finally:
        conn.close()

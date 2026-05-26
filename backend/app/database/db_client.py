import os
import sqlite3
import logging

logger = logging.getLogger("sentra-ai")

# DB location defaults to backend/sentra.db relative to monorepo root
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "sentra.db"))

def get_connection() -> sqlite3.Connection:
    """Returns a new SQLite connection with foreign keys enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn

def run_migrations():
    """Sets up schema tables, runs migrations, and triggers data retention cleanup."""
    logger.info(f"Initializing database connection: {DB_PATH}")
    
    conn = get_connection()
    try:
        # Create migrations metadata table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Check current database version
        cursor = conn.cursor()
        cursor.execute("SELECT MAX(version) FROM schema_migrations")
        current_version_row = cursor.fetchone()
        current_version = current_version_row[0] if current_version_row and current_version_row[0] is not None else 0
        
        logger.info(f"Current database schema version: {current_version}")
        
        # Migration 1: Create deliveries and telemetry tables
        if current_version < 1:
            logger.info("Applying database migration version 1...")
            conn.execute("""
                CREATE TABLE webhook_deliveries (
                    delivery_id TEXT PRIMARY KEY,
                    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE scan_telemetry (
                    scan_id TEXT PRIMARY KEY,
                    repo_name TEXT NOT NULL,
                    pr_number INTEGER NOT NULL,
                    head_sha TEXT NOT NULL,
                    status TEXT NOT NULL,
                    findings_count INTEGER DEFAULT 0,
                    suppressed_count INTEGER DEFAULT 0,
                    parse_time REAL DEFAULT 0.0,
                    scan_time REAL DEFAULT 0.0,
                    remediation_time REAL DEFAULT 0.0,
                    total_time REAL DEFAULT 0.0,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("INSERT INTO schema_migrations (version) VALUES (1)")
            conn.commit()
            logger.info("Migration version 1 applied successfully.")

        # Migration 2: Create suppression_audit table for per-rule suppression metrics
        if current_version < 2:
            logger.info("Applying database migration version 2...")
            conn.execute("""
                CREATE TABLE suppression_audit (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    scan_id TEXT NOT NULL,
                    repo_name TEXT NOT NULL,
                    rule_id TEXT NOT NULL,
                    resource_key TEXT NOT NULL,
                    reason TEXT,
                    suppressed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (scan_id) REFERENCES scan_telemetry(scan_id)
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_suppression_audit_repo ON suppression_audit(repo_name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_suppression_audit_rule ON suppression_audit(rule_id)")
            conn.execute("INSERT INTO schema_migrations (version) VALUES (2)")
            conn.commit()
            logger.info("Migration version 2 applied successfully.")

        # Migration 3: autofix_prs table — tracks every auto-fix PR SentraAI creates
        if current_version < 3:
            logger.info("Applying database migration version 3...")
            conn.execute("""
                CREATE TABLE autofix_prs (
                    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                    scan_id              TEXT NOT NULL,
                    repo_name            TEXT NOT NULL,
                    rule_id              TEXT NOT NULL,
                    file_path            TEXT NOT NULL,
                    branch_name          TEXT NOT NULL,
                    pr_url               TEXT,
                    pr_number            INTEGER,
                    pr_fingerprint       TEXT,         -- SHA256 of rule+file+fix for dedup
                    source_content_hash  TEXT,         -- SHA256 of original vulnerable content
                    fix_safety_tier      TEXT,         -- SAFE / REVIEW_REQUIRED / EXPERIMENTAL / NONE
                    status               TEXT NOT NULL, -- CREATED / DUPLICATE_SKIPPED / FAILED / MERGED / CLOSED / STALE / COOLDOWN_SKIPPED
                    failure_reason       TEXT,         -- Populated on FAILED status
                    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            # Index for cooldown queries: find recent PRs for same repo+rule+file within 24h
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_autofix_prs_cooldown
                ON autofix_prs(repo_name, rule_id, file_path, created_at)
            """)
            # Index for fingerprint deduplication lookups
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_autofix_prs_fingerprint
                ON autofix_prs(pr_fingerprint)
            """)
            conn.execute("INSERT INTO schema_migrations (version) VALUES (3)")
            conn.commit()
            logger.info("Migration version 3 applied successfully.")

        # Migration 4: approval_audit_logs table — tracks GitOps approval workflow audit logs
        if current_version < 4:
            logger.info("Applying database migration version 4...")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS approval_audit_logs (
                    id             INTEGER PRIMARY KEY AUTOINCREMENT,
                    scan_id        TEXT NOT NULL,
                    repo_name      TEXT NOT NULL,
                    finding_id     TEXT NOT NULL,
                    actor          TEXT NOT NULL,
                    command        TEXT NOT NULL,
                    mode           TEXT NOT NULL,
                    pr_url         TEXT,
                    status         TEXT NOT NULL, -- APPROVED / REJECTED / EXPIRED / FAILED / DUPLICATE
                    failure_reason TEXT,
                    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("INSERT INTO schema_migrations (version) VALUES (4)")
            conn.commit()
            logger.info("Migration version 4 applied successfully.")
            
        # Run retention limit cleanups (30 days retention policy)
        clean_retention_data(conn)
        
    except Exception as e:
        logger.error(f"Failed to execute schema migrations: {str(e)}")
        conn.rollback()
        raise e
    finally:
        conn.close()

def clean_retention_data(conn: sqlite3.Connection):
    """Deletes telemetry logs and webhook deliveries older than 30 days."""
    try:
        cursor = conn.cursor()
        
        # Delete entries older than 30 days
        cursor.execute("DELETE FROM scan_telemetry WHERE datetime(timestamp) < datetime('now', '-30 days')")
        deleted_telemetry = cursor.rowcount
        
        cursor.execute("DELETE FROM webhook_deliveries WHERE datetime(processed_at) < datetime('now', '-30 days')")
        deleted_deliveries = cursor.rowcount
        
        if deleted_telemetry > 0 or deleted_deliveries > 0:
            conn.commit()
            logger.info(f"Retention Cleanup: Deleted {deleted_telemetry} telemetry entries and {deleted_deliveries} delivery cache entries older than 30 days.")
    except Exception as e:
        logger.warning(f"Database retention cleanup failed: {str(e)}")

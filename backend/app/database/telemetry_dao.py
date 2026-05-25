import sqlite3
import logging
from typing import List, Dict, Any
from backend.app.database.db_client import get_connection

logger = logging.getLogger("sentra-ai")

def register_delivery_id(delivery_id: str) -> bool:
    """
    Attempts to register a webhook delivery ID in the persistent SQLite cache.
    Returns True if registration succeeded (new delivery), False if it is a duplicate.
    """
    conn = get_connection()
    try:
        conn.execute("INSERT INTO webhook_deliveries (delivery_id) VALUES (?)", (delivery_id,))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        # IntegrityError signifies key collision (duplicate webhook delivery)
        return False
    except Exception as e:
        logger.error(f"Failed to register webhook delivery in SQLite: {str(e)}")
        # Default to True to prevent dropping webhook events on system errors
        return True
    finally:
        conn.close()

def save_scan_telemetry(
    scan_id: str,
    repo_name: str,
    pr_number: int,
    head_sha: str,
    status: str,
    findings_count: int,
    suppressed_count: int,
    parse_time: float,
    scan_time: float,
    remediation_time: float,
    total_time: float
) -> None:
    """Saves a scan telemetry log entry in SQLite for metrics logging and auditing."""
    conn = get_connection()
    try:
        conn.execute("""
            INSERT INTO scan_telemetry (
                scan_id, repo_name, pr_number, head_sha, status, 
                findings_count, suppressed_count, parse_time, scan_time, 
                remediation_time, total_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            scan_id, repo_name, pr_number, head_sha, status,
            findings_count, suppressed_count, parse_time, scan_time,
            remediation_time, total_time
        ))
        conn.commit()
        logger.info(f"[{scan_id}] Persistent telemetry record written successfully.")
    except Exception as e:
        logger.error(f"[{scan_id}] Failed to write telemetry record to SQLite: {str(e)}")
    finally:
        conn.close()


def save_suppression_audit(
    scan_id: str,
    repo_name: str,
    suppressed_findings: List[Dict[str, Any]]
) -> None:
    """
    Writes individual suppression records to the suppression_audit table.
    One row per suppressed finding, enabling per-rule telemetry queries:
    - Most suppressed rule IDs across all repos
    - Repos with the highest total suppressions
    - Time-series suppression adoption patterns (abuse detection signals)

    This is strictly additive — it never modifies or deletes existing records.
    Failures are logged and silently swallowed to prevent scan interruptions.
    """
    if not suppressed_findings:
        return

    conn = get_connection()
    try:
        for sf in suppressed_findings:
            conn.execute("""
                INSERT INTO suppression_audit (scan_id, repo_name, rule_id, resource_key, reason)
                VALUES (?, ?, ?, ?, ?)
            """, (
                scan_id,
                repo_name,
                sf.get("rule_id", "UNKNOWN"),
                sf.get("resource", "UNKNOWN"),
                sf.get("reason", "No reason provided")
            ))
        conn.commit()
        logger.info(
            f"[{scan_id}] Suppression audit: {len(suppressed_findings)} record(s) written "
            f"for repo '{repo_name}'."
        )
    except Exception as e:
        logger.error(f"[{scan_id}] Failed to write suppression audit records: {str(e)}")
    finally:
        conn.close()

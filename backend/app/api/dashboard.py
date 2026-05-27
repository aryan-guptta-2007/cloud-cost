from fastapi import APIRouter, HTTPException, status
from typing import Dict, Any, List
from app.database.db_client import get_connection

router = APIRouter(prefix="/api")

@router.get("/stats", response_model=Dict[str, Any])
def get_dashboard_stats():
    """
    Computes aggregated performance and telemetry stats from the database
    to render on the dashboard UI.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # Scans Count
        cursor.execute("SELECT COUNT(*) FROM scan_telemetry")
        total_scans = cursor.fetchone()[0] or 0
        
        # Findings Count
        cursor.execute("SELECT SUM(findings_count) FROM scan_telemetry")
        total_findings = cursor.fetchone()[0] or 0

        # Suppressed Findings Count
        cursor.execute("SELECT SUM(suppressed_count) FROM scan_telemetry")
        total_suppressed = cursor.fetchone()[0] or 0
        
        # Autofix PRs created
        cursor.execute("SELECT COUNT(*) FROM autofix_prs WHERE status = 'CREATED'")
        total_autofix_prs = cursor.fetchone()[0] or 0

        # GitOps approvals count
        cursor.execute("SELECT COUNT(*) FROM approval_audit_logs WHERE status = 'APPROVED'")
        total_gitops_approvals = cursor.fetchone()[0] or 0

        # Average scan duration
        cursor.execute("SELECT AVG(total_time) FROM scan_telemetry")
        avg_scan_time = cursor.fetchone()[0] or 0.0

        # Total hours saved calculation (estimate: 20 minutes per manual fix, 5 minutes per manual check)
        # 1/12 hour (5 mins) per scan + 1/3 hour (20 mins) per created PR
        hours_saved = (total_scans * 5 / 60) + (total_autofix_prs * 20 / 60)

        return {
            "total_scans": total_scans,
            "total_findings": total_findings,
            "total_suppressed": total_suppressed,
            "total_autofix_prs": total_autofix_prs,
            "total_gitops_approvals": total_gitops_approvals,
            "avg_scan_time_seconds": round(avg_scan_time, 2),
            "estimated_hours_saved": round(hours_saved, 1)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database aggregation failed: {str(e)}"
        )
    finally:
        conn.close()


@router.get("/scans", response_model=List[Dict[str, Any]])
def get_recent_scans():
    """
    Returns the most recent 20 scan telemetry logs.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT scan_id, repo_name, pr_number, head_sha, status, 
                   findings_count, suppressed_count, total_time, timestamp 
            FROM scan_telemetry 
            ORDER BY timestamp DESC 
            LIMIT 20
        """)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch recent scans: {str(e)}"
        )
    finally:
        conn.close()


@router.get("/approvals", response_model=List[Dict[str, Any]])
def get_recent_approvals():
    """
    Returns the most recent 20 GitOps approval and reject audit logs.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, scan_id, repo_name, finding_id, actor, command, 
                   mode, pr_url, status, failure_reason, created_at 
            FROM approval_audit_logs 
            ORDER BY created_at DESC 
            LIMIT 20
        """)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch approval logs: {str(e)}"
        )
    finally:
        conn.close()


@router.get("/autofixes", response_model=List[Dict[str, Any]])
def get_recent_autofixes():
    """
    Returns the most recent 20 auto-fix PR attempts.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, scan_id, repo_name, rule_id, file_path, branch_name, 
                   pr_url, pr_number, status, failure_reason, created_at 
            FROM autofix_prs 
            ORDER BY created_at DESC 
            LIMIT 20
        """)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch autofix records: {str(e)}"
        )
    finally:
        conn.close()

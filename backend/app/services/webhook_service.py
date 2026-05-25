import logging
from typing import Dict, Any
from backend.app.services.github_service import GitHubProvider
from backend.app.services.scan_service import scan_pr_files
from backend.app.services.comment_service import build_pr_comment_body
from backend.app.database.telemetry_dao import register_delivery_id

logger = logging.getLogger("sentra-ai")

async def process_pull_request_webhook(delivery_id: str, payload: Dict[str, Any]) -> None:
    """
    Processes 'pull_request' webhook payloads.
    Filters actions, verifies idempotency in SQLite, triggers scans, and posts PR reviews.
    """
    action = payload.get("action")
    allowed_actions = {"opened", "synchronize", "reopened"}
    
    if action not in allowed_actions:
        logger.info(f"Ignoring pull_request action: {action}")
        return

    # Check idempotency using persistent SQLite delivery cache
    if not register_delivery_id(delivery_id):
        logger.warning(f"Duplicate webhook delivery detected (ID: {delivery_id}). Skipping execution.")
        return

    pull_request = payload.get("pull_request", {})
    pr_number = payload.get("number")
    repository = payload.get("repository", {})
    repo_full_name = repository.get("full_name")
    
    installation = payload.get("installation", {})
    installation_id = installation.get("id")
    
    head = pull_request.get("head", {})
    sha = head.get("sha")

    if not all([pr_number, repo_full_name, installation_id, sha]):
        logger.error(f"Invalid webhook payload: Missing PR metadata or installation configs. Payload ID: {delivery_id}")
        return

    logger.info(f"Processing webhook {delivery_id}: {repo_full_name} PR #{pr_number} (commit: {sha})")

    # 1. Initialize GitHub Client Provider
    github_provider = GitHubProvider(installation_id)

    # 2. Trigger check run status on GitHub
    check_run_id = await github_provider.create_check_run(repo_full_name, sha)

    # 3. Trigger Scan and Remediation Engines
    scan_id, status, findings, suppressed_findings, metrics = await scan_pr_files(
        github_provider,
        repo_full_name,
        pr_number,
        sha
    )

    # 4. Compile Markdown PR Comment body
    comment_body = build_pr_comment_body(scan_id, status, findings, suppressed_findings, metrics)

    # 5. Dispatch Comment posting / editing
    try:
        await github_provider.post_or_update_pr_comment(repo_full_name, pr_number, comment_body)
    except Exception as e:
        logger.error(f"[{scan_id}] Failed to deliver comment to GitHub PR #{pr_number}: {str(e)}")

    # 6. Update GitHub Check Run status based on highest severity
    if check_run_id:
        conclusion = "success"
        summary = "No security findings detected in the PR."
        
        # Include suppressed details count in summary
        findings_count = len(findings)
        suppressed_count = len(suppressed_findings)
        
        if findings_count > 0:
            has_critical_or_high = any(f.severity.value in {"CRITICAL", "HIGH"} for f in findings)
            conclusion = "failure" if has_critical_or_high else "neutral"
            
            critical_count = sum(1 for f in findings if f.severity.value == "CRITICAL")
            high_count = sum(1 for f in findings if f.severity.value == "HIGH")
            other_count = findings_count - (critical_count + high_count)
            
            summary = (
                f"SentraAI detected {findings_count} security findings:\n"
                f"- Critical: {critical_count}\n"
                f"- High: {high_count}\n"
                f"- Medium/Low: {other_count}\n\n"
                f"Please review the inline PR comments for remediation diffs."
            )
        
        if suppressed_count > 0:
            summary += f"\n\nNote: {suppressed_count} finding(s) were suppressed via sentra-ignore comments."
            
        if status.startswith("PARTIAL"):
            summary += f"\n\nWarning: The scan completed partially (status: {status}). Some files were skipped."
        elif status == "FAILED":
            conclusion = "failure"
            summary = "SentraAI scan failed due to a system execution error."

        await github_provider.update_check_run(repo_full_name, check_run_id, conclusion, summary)

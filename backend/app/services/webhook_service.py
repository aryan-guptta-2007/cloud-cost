import logging
from typing import Set, Dict, Any
from backend.app.services.github_service import GitHubProvider
from backend.app.services.scan_service import scan_pr_files
from backend.app.services.comment_service import build_pr_comment_body

logger = logging.getLogger("sentra-ai")

# In-memory delivery cache to enforce idempotency
PROCESSED_DELIVERIES: Set[str] = set()
# Max cache size to prevent memory leak
MAX_CACHE_SIZE = 10000

def check_and_register_delivery(delivery_id: str) -> bool:
    """
    Checks if a webhook delivery has already been processed.
    Registers the delivery ID and returns True if it's new, False otherwise.
    """
    global PROCESSED_DELIVERIES
    if delivery_id in PROCESSED_DELIVERIES:
        return False
    
    # Enforce cache boundary limit
    if len(PROCESSED_DELIVERIES) >= MAX_CACHE_SIZE:
        PROCESSED_DELIVERIES.clear()
        
    PROCESSED_DELIVERIES.add(delivery_id)
    return True

async def process_pull_request_webhook(delivery_id: str, payload: Dict[str, Any]) -> None:
    """
    Processes 'pull_request' webhook payloads.
    Filters actions, triggers scans, and posts the compiled remediation summary.
    """
    action = payload.get("action")
    allowed_actions = {"opened", "synchronize", "reopened"}
    
    if action not in allowed_actions:
        logger.info(f"Ignoring pull_request action: {action}")
        return

    # Check idempotency
    if not check_and_register_delivery(delivery_id):
        logger.warning(f"Duplicate webhook delivery detected (ID: {delivery_id}). Skipping execution.")
        return

    pull_request = payload.get("pull_request", {})
    pr_number = payload.get("number")
    repository = payload.get("repository", {})
    repo_full_name = repository.get("full_name")
    
    installation = payload.get("installation", {})
    installation_id = installation.get("id")
    
    # Extract git commit reference (head SHA)
    head = pull_request.get("head", {})
    sha = head.get("sha")

    if not all([pr_number, repo_full_name, installation_id, sha]):
        logger.error(f"Invalid webhook payload: Missing PR metadata or installation configs. Payload ID: {delivery_id}")
        return

    logger.info(f"Processing webhook {delivery_id}: {repo_full_name} PR #{pr_number} (commit: {sha})")

    # 1. Initialize GitHub Client Provider
    github_provider = GitHubProvider(installation_id)

    # 2. Trigger Scan and Remediation Engines
    scan_id, status, findings, metrics = await scan_pr_files(
        github_provider,
        repo_full_name,
        pr_number,
        sha
    )

    # 3. Compile Markdown PR Comment body
    comment_body = build_pr_comment_body(scan_id, status, findings, metrics)

    # 4. Dispatch Comment posting / editing
    try:
        await github_provider.post_or_update_pr_comment(repo_full_name, pr_number, comment_body)
    except Exception as e:
        logger.error(f"[{scan_id}] Failed to deliver comment to GitHub PR #{pr_number}: {str(e)}")

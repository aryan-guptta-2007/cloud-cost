import logging
from typing import Dict, Any
from app.services.github_service import GitHubProvider
from app.services.scan_service import scan_pr_files
from app.services.comment_service import build_pr_comment_body
from app.services.autofix_service import run_autofix_workflows
from app.database.telemetry_dao import register_delivery_id
from app.config import SENTRA_REMEDIATION_MODE, RemediationMode

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

    # 7. Run autofix PR workflows for eligible findings (autonomous mode only — isolated)
    if SENTRA_REMEDIATION_MODE == RemediationMode.AUTONOMOUS:
        try:
            autofix_results = await run_autofix_workflows(
                git_provider=github_provider,
                repo_full_name=repo_full_name,
                base_sha=sha,
                scan_id=scan_id,
                original_pr_number=pr_number,
                findings=findings
            )
            created_prs = sum(1 for r in autofix_results if r.get("status") == "CREATED")
            if created_prs > 0:
                logger.info(f"[{scan_id}] Autofix: {created_prs} remediation PR(s) opened for {repo_full_name} PR #{pr_number}.")
        except Exception as e:
            logger.error(f"[{scan_id}] Autofix workflow failed (non-critical): {str(e)}")
    else:
        logger.info(f"[{scan_id}] Skipping autonomous autofix execution. Current mode: '{SENTRA_REMEDIATION_MODE}'")


async def process_review_comment_webhook(delivery_id: str, payload: Dict[str, Any]) -> None:
    """
    Processes 'pull_request_review_comment' webhook payloads.
    Verifies that the comment is a command, checks actor permissions,
    extracts metadata tags from parent comment, validates, creates branch/PR,
    and replies to the comment thread.
    """
    action = payload.get("action")
    if action != "created":
        logger.info(f"Ignoring review comment action: {action}")
        return

    comment = payload.get("comment", {})
    comment_body = comment.get("body", "").strip()
    
    # Parse command
    cmd_tokens = comment_body.split()
    cmd = cmd_tokens[0].lower() if cmd_tokens else ""
    if cmd not in {"/approve", "/fix", "/sentra-fix"}:
        logger.info(f"Ignoring review comment: does not start with approval command.")
        return

    repository = payload.get("repository", {})
    repo_full_name = repository.get("full_name")
    pull_request = payload.get("pull_request", {})
    pr_number = pull_request.get("number")
    comment_id = comment.get("id")
    
    installation = payload.get("installation", {})
    installation_id = installation.get("id")

    if not all([repo_full_name, pr_number, comment_id, installation_id]):
        logger.error(f"Invalid webhook payload: Missing PR/comment metadata or installation configs. Payload ID: {delivery_id}")
        return

    logger.info(f"Processing GitOps command {cmd} by user in {repo_full_name} PR #{pr_number}")

    # Initialize Git Provider
    github_provider = GitHubProvider(installation_id)

    # Validate Actor Authorization
    author_assoc = comment.get("author_association")
    actor = comment.get("user", {}).get("login", "unknown")
    allowed_associations = {"OWNER", "MEMBER", "COLLABORATOR"}

    from app.database.telemetry_dao import save_approval_audit_log, get_existing_autofix_pr

    if author_assoc not in allowed_associations:
        reply_body = f"❌ **SentraAI: Authorization Warning**\nSorry @{actor}, only users with write/admin access (`OWNER`, `MEMBER`, or `COLLABORATOR` association) are permitted to authorize security remediations. Your command was ignored."
        logger.warning(f"Unauthorized comment command by {actor} ({author_assoc}) in {repo_full_name}")
        
        save_approval_audit_log(
            scan_id="N/A",
            repo_name=repo_full_name,
            finding_id="N/A",
            actor=actor,
            command=comment_body,
            mode=SENTRA_REMEDIATION_MODE,
            status="REJECTED",
            failure_reason=f"Actor {actor} association {author_assoc} is not permitted"
        )
        
        try:
            await github_provider.post_pull_request_comment_reply(
                repo_full_name=repo_full_name,
                pull_number=pr_number,
                comment_id=comment_id,
                body=reply_body
            )
        except Exception as e:
            logger.error(f"Failed to post authorization failure reply: {str(e)}")
        return

    # Check parent comment reply link
    in_reply_to_id = comment.get("in_reply_to_id")
    if not in_reply_to_id:
        reply_body = "❌ **SentraAI: Execution Error**\nCould not resolve remediation metadata. Please make sure you are replying `/approve` directly to a SentraAI security comment."
        try:
            await github_provider.post_pull_request_comment_reply(
                repo_full_name=repo_full_name,
                pull_number=pr_number,
                comment_id=comment_id,
                body=reply_body
            )
        except Exception as e:
            logger.error(f"Failed to post error reply: {str(e)}")
        return

    # Fetch parent comment
    try:
        parent_comment = await github_provider.get_single_pull_request_comment(repo_full_name, in_reply_to_id)
    except Exception as e:
        logger.error(f"Failed to fetch parent comment {in_reply_to_id}: {str(e)}")
        reply_body = f"❌ **SentraAI: Execution Error**\nFailed to retrieve the parent comment from GitHub: {str(e)}"
        try:
            await github_provider.post_pull_request_comment_reply(
                repo_full_name=repo_full_name,
                pull_number=pr_number,
                comment_id=comment_id,
                body=reply_body
            )
        except Exception as err:
            logger.error(f"Failed to post parent comment fetch error reply: {str(err)}")
        return

    # Parse metadata tags from parent comment
    parent_body = parent_comment.get("body", "")
    
    import re
    rule_id_match = re.search(r"<!--\s*SentraAI-RuleID:\s*([^\s-]+(?:_[^\s-]+)*)\s*-->", parent_body)
    file_path_match = re.search(r"<!--\s*SentraAI-FilePath:\s*([^\s]+)\s*-->", parent_body)
    line_number_match = re.search(r"<!--\s*SentraAI-LineNumber:\s*(\d+)\s*-->", parent_body)
    scan_id_match = re.search(r"<!--\s*SentraAI-ScanID:\s*([a-fA-F0-9-]+)\s*-->", parent_body)
    preview_hash_match = re.search(r"<!--\s*SentraAI-PreviewHash:\s*([a-fA-F0-9]+)\s*-->", parent_body)

    if not (rule_id_match and file_path_match and line_number_match):
        reply_body = "❌ **SentraAI: Execution Error**\nCould not parse remediation metadata from the parent comment. Please reply directly to an intact SentraAI security comment."
        try:
            await github_provider.post_pull_request_comment_reply(
                repo_full_name=repo_full_name,
                pull_number=pr_number,
                comment_id=comment_id,
                body=reply_body
            )
        except Exception as e:
            logger.error(f"Failed to post parsing error reply: {str(e)}")
        return

    rule_id = rule_id_match.group(1)
    file_path = file_path_match.group(1)
    line_number = int(line_number_match.group(1))
    scan_id = scan_id_match.group(1) if scan_id_match else "unknown-scan"
    preview_hash = preview_hash_match.group(1) if preview_hash_match else None

    # Check Operational Mode
    if SENTRA_REMEDIATION_MODE in {RemediationMode.COMMENT_ONLY, RemediationMode.PREVIEW_ONLY}:
        reply_body = f"❌ **SentraAI: Feature Disabled**\nGitOps approval is not enabled in the current configuration (Operational Mode: `{SENTRA_REMEDIATION_MODE}`)."
        try:
            await github_provider.post_pull_request_comment_reply(
                repo_full_name=repo_full_name,
                pull_number=pr_number,
                comment_id=comment_id,
                body=reply_body
            )
        except Exception as e:
            logger.error(f"Failed to post mode disabled reply: {str(e)}")
        return

    # Check Expiration (24h default)
    from datetime import datetime, timezone
    parent_created_at_str = parent_comment.get("created_at")
    if parent_created_at_str:
        try:
            parent_created_at = datetime.fromisoformat(parent_created_at_str.replace("Z", "+00:00"))
            age_seconds = (datetime.now(timezone.utc) - parent_created_at).total_seconds()
            
            from app.config import os as config_os
            expiration_hours = int(config_os.getenv("SENTRA_APPROVAL_EXPIRATION_HOURS", "24"))
            if age_seconds > expiration_hours * 3600:
                reply_body = f"❌ **SentraAI: Expiration Error**\nThis security comment has expired. Approvals are only valid for {expiration_hours} hours to prevent configuration drift."
                save_approval_audit_log(
                    scan_id=scan_id,
                    repo_name=repo_full_name,
                    finding_id=rule_id,
                    actor=actor,
                    command=comment_body,
                    mode=SENTRA_REMEDIATION_MODE,
                    status="EXPIRED",
                    failure_reason=f"Comment age is {age_seconds / 3600:.1f} hours, which exceeds limit of {expiration_hours} hours"
                )
                try:
                    await github_provider.post_pull_request_comment_reply(
                        repo_full_name=repo_full_name,
                        pull_number=pr_number,
                        comment_id=comment_id,
                        body=reply_body
                    )
                except Exception as e:
                    logger.error(f"Failed to post expiration error reply: {str(e)}")
                return
        except Exception as ex_err:
            logger.warning(f"Failed to parse parent comment created_at '{parent_created_at_str}': {str(ex_err)}")

    # Check Command Idempotency
    from app.services.autofix_service import _build_branch_name
    branch_name = _build_branch_name(rule_id, scan_id)

    existing_pr_url = get_existing_autofix_pr(repo_full_name, branch_name)
    if not existing_pr_url:
        existing_pr_number = await github_provider.find_open_pr_for_branch(repo_full_name, branch_name)
        if existing_pr_number:
            existing_pr_url = f"https://github.com/{repo_full_name}/pull/{existing_pr_number}"

    if existing_pr_url:
        reply_body = f"💡 **SentraAI: Remediating PR already exists**\nA remediation PR has already been created for this finding: {existing_pr_url}"
        save_approval_audit_log(
            scan_id=scan_id,
            repo_name=repo_full_name,
            finding_id=rule_id,
            actor=actor,
            command=comment_body,
            mode=SENTRA_REMEDIATION_MODE,
            status="DUPLICATE",
            pr_url=existing_pr_url
        )
        try:
            await github_provider.post_pull_request_comment_reply(
                repo_full_name=repo_full_name,
                pull_number=pr_number,
                comment_id=comment_id,
                body=reply_body
            )
        except Exception as e:
            logger.error(f"Failed to post duplicate PR reply: {str(e)}")
        return

    # Fetch pull request commit SHA
    sha = pull_request.get("head", {}).get("sha") or comment.get("commit_id")
    if not sha:
        reply_body = "❌ **SentraAI: Execution Error**\nCould not resolve pull request commit SHA."
        try:
            await github_provider.post_pull_request_comment_reply(
                repo_full_name=repo_full_name,
                pull_number=pr_number,
                comment_id=comment_id,
                body=reply_body
            )
        except Exception as e:
            logger.error(f"Failed to post commit SHA error reply: {str(e)}")
        return

    # Fetch file content at commit SHA
    try:
        file_content = await github_provider.get_file_content(repo_full_name, file_path, sha)
    except Exception as e:
        logger.error(f"Failed to fetch content for file {file_path} at SHA {sha}: {str(e)}")
        reply_body = f"❌ **SentraAI: Execution Error**\nFailed to fetch content for `{file_path}` from GitHub: {str(e)}"
        try:
            await github_provider.post_pull_request_comment_reply(
                repo_full_name=repo_full_name,
                pull_number=pr_number,
                comment_id=comment_id,
                body=reply_body
            )
        except Exception as err:
            logger.error(f"Failed to post file content fetch error reply: {str(err)}")
        return

    # Scan and find matching finding
    from scanner_engine.parsers.tf_parser import parse_tf_string, ParseError
    from scanner_engine.rule_registry import registry
    from shared.schemas.finding_schema import Finding

    try:
        parsed_data = parse_tf_string(file_content)
        rule = next((r for r in registry.get_all_rules() if r.id == rule_id), None)
        if not rule:
            reply_body = f"❌ **SentraAI: Execution Error**\nRule `{rule_id}` is not registered in the system."
            try:
                await github_provider.post_pull_request_comment_reply(repo_full_name, pr_number, comment_id, reply_body)
            except Exception as e:
                logger.error(f"Failed to post rule registration error reply: {str(e)}")
            return
            
        findings = rule.check(parsed_data, file_path)
    except ParseError as pe:
        reply_body = f"❌ **SentraAI: Code Parsing Error**\nFailed to parse HCL in `{file_path}`: {str(pe)}"
        try:
            await github_provider.post_pull_request_comment_reply(repo_full_name, pr_number, comment_id, reply_body)
        except Exception as e:
            logger.error(f"Failed to post parsing error reply: {str(e)}")
        return
    except Exception as e:
        reply_body = f"❌ **SentraAI: Execution Error**\nAn unexpected error occurred while analyzing the file: {str(e)}"
        try:
            await github_provider.post_pull_request_comment_reply(repo_full_name, pr_number, comment_id, reply_body)
        except Exception as err:
            logger.error(f"Failed to post scanning error reply: {str(err)}")
        return

    # Find matching finding by exact line or general fallback
    matching_finding = None
    for f in findings:
        if f.line_number == line_number:
            matching_finding = f
            break

    if not matching_finding and len(findings) == 1:
        matching_finding = findings[0]

    if not matching_finding:
        reply_body = "💡 **SentraAI: Finding resolved**\nThe security finding was not detected in the current code at HEAD. It might have already been resolved or changed!"
        try:
            await github_provider.post_pull_request_comment_reply(repo_full_name, pr_number, comment_id, reply_body)
        except Exception as e:
            logger.error(f"Failed to post finding resolved reply: {str(e)}")
        return

    # Fetch remediation and policy parameters
    from remediation_engine.remediation_registry import remediation_registry
    from remediation_engine.autofix_policy import get_autofix_policy

    if matching_finding.resource_type and matching_finding.resource_name:
        remediation = remediation_registry.get_remediation_in_memory(
            matching_finding.rule_id,
            file_path,
            matching_finding.resource_type,
            matching_finding.resource_name,
            file_content
        )
        if remediation:
            matching_finding.remediation_type = remediation.get("remediation_type")
            matching_finding.remediation_mode = remediation.get("remediation_mode")
            matching_finding.fix_confidence = remediation.get("fix_confidence", 1.0)
            matching_finding.remediation_diff = remediation.get("remediation_diff")
            matching_finding.explanation = remediation.get("explanation")
            
        autofix_policy = get_autofix_policy(matching_finding.rule_id)
        matching_finding.safe_for_autofix = autofix_policy.safe_for_autofix
        matching_finding.requires_human_review = autofix_policy.requires_human_review
        matching_finding.fix_safety_tier = autofix_policy.fix_safety_tier

    # Check if eligible for GitOps approval
    if not matching_finding.safe_for_autofix or not matching_finding.remediation_diff:
        reply_body = f"❌ **SentraAI: Remediation Blocked**\nRule `{rule_id}` is not eligible for autonomous remediation (Safety Tier: `{matching_finding.fix_safety_tier}`). Only fully safe, deterministic remediations (such as `AWS_S3_PUBLIC` or `AWS_DB_UNENCRYPTED`) are allowed to trigger GitOps auto-fixes."
        try:
            await github_provider.post_pull_request_comment_reply(repo_full_name, pr_number, comment_id, reply_body)
        except Exception as e:
            logger.error(f"Failed to post safety restriction reply: {str(e)}")
        return

    # Validate Dry-run Preview Hash
    if preview_hash and matching_finding.remediation_diff:
        import hashlib
        current_hash = hashlib.sha256(matching_finding.remediation_diff.strip().encode("utf-8")).hexdigest()
        if current_hash != preview_hash:
            reply_body = "⚠️ **SentraAI: Code drift detected**\nThe code has changed since the remediation preview was generated. Please run a new scan to generate a fresh preview before approving."
            save_approval_audit_log(
                scan_id=scan_id,
                repo_name=repo_full_name,
                finding_id=rule_id,
                actor=actor,
                command=comment_body,
                mode=SENTRA_REMEDIATION_MODE,
                status="FAILED",
                failure_reason="DRIFT: Preview hash mismatch"
            )
            try:
                await github_provider.post_pull_request_comment_reply(repo_full_name, pr_number, comment_id, reply_body)
            except Exception as e:
                logger.error(f"Failed to post preview hash mismatch reply: {str(e)}")
            return

    # Execute Autofix Workflow
    try:
        results = await run_autofix_workflows(
            git_provider=github_provider,
            repo_full_name=repo_full_name,
            base_sha=sha,
            scan_id=scan_id,
            original_pr_number=pr_number,
            findings=[matching_finding]
        )
    except Exception as e:
        logger.error(f"[{scan_id}] Autofix run_autofix_workflows failed: {str(e)}")
        reply_body = f"❌ **SentraAI: Execution Error**\nFailed to execute autofix workflow: {str(e)}"
        save_approval_audit_log(
            scan_id=scan_id,
            repo_name=repo_full_name,
            finding_id=rule_id,
            actor=actor,
            command=comment_body,
            mode=SENTRA_REMEDIATION_MODE,
            status="FAILED",
            failure_reason=f"Workflow exception: {str(e)}"
        )
        try:
            await github_provider.post_pull_request_comment_reply(repo_full_name, pr_number, comment_id, reply_body)
        except Exception as err:
            logger.error(f"Failed to post workflow error reply: {str(err)}")
        return

    # Handle workflow outcome
    if results and results[0].get("status") == "CREATED":
        pr_url = results[0].get("pr_url")
        reply_body = f"🚀 **SentraAI: Remediation PR Created!**\nApproval verified for @{actor}. The secure remediation pull request has been opened successfully:\n👉 {pr_url}"
        save_approval_audit_log(
            scan_id=scan_id,
            repo_name=repo_full_name,
            finding_id=rule_id,
            actor=actor,
            command=comment_body,
            mode=SENTRA_REMEDIATION_MODE,
            status="APPROVED",
            pr_url=pr_url
        )
    else:
        status = results[0].get("status") if results else "FAILED"
        reason = results[0].get("reason") if results else "Unknown error"
        
        if status == "DUPLICATE_SKIPPED":
            # Re-resolve PR url
            existing_pr_url = get_existing_autofix_pr(repo_full_name, branch_name)
            if not existing_pr_url:
                existing_pr_number = await github_provider.find_open_pr_for_branch(repo_full_name, branch_name)
                if existing_pr_number:
                    existing_pr_url = f"https://github.com/{repo_full_name}/pull/{existing_pr_number}"
            
            reply_body = f"💡 **SentraAI: Remediating PR already exists**\nA remediation PR has already been created for this finding: {existing_pr_url}"
            save_approval_audit_log(
                scan_id=scan_id,
                repo_name=repo_full_name,
                finding_id=rule_id,
                actor=actor,
                command=comment_body,
                mode=SENTRA_REMEDIATION_MODE,
                status="DUPLICATE",
                pr_url=existing_pr_url
            )
        elif status == "COOLDOWN_SKIPPED":
            reply_body = "⚠️ **SentraAI: Cooldown Active**\nAn autofix PR was already created for this rule and file within the last 24 hours. Skipping PR creation to prevent comment storm."
            save_approval_audit_log(
                scan_id=scan_id,
                repo_name=repo_full_name,
                finding_id=rule_id,
                actor=actor,
                command=comment_body,
                mode=SENTRA_REMEDIATION_MODE,
                status="FAILED",
                failure_reason="COOLDOWN_ACTIVE"
            )
        else:
            reply_body = f"❌ **SentraAI: Remediation Failed**\nFailed to create remediation PR (Status: `{status}`). Reason: `{reason}`."
            save_approval_audit_log(
                scan_id=scan_id,
                repo_name=repo_full_name,
                finding_id=rule_id,
                actor=actor,
                command=comment_body,
                mode=SENTRA_REMEDIATION_MODE,
                status="FAILED",
                failure_reason=f"Status: {status}, Reason: {reason}"
            )
            
    try:
        await github_provider.post_pull_request_comment_reply(repo_full_name, pr_number, comment_id, reply_body)
    except Exception as e:
        logger.error(f"Failed to post final workflow outcome reply comment: {str(e)}")


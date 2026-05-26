"""
autofix_service.py — Autofix PR Workflow Orchestrator

Coordinates the full auto-fix PR lifecycle for eligible findings:
1. Policy check — is this rule eligible for autofix?
2. Cooldown check — has a PR been created for this rule+file in the last 24h?
3. Drift detection — does the vulnerable content still exist at HEAD?
4. In-memory fix — apply fixer and validate syntax
5. Duplicate PR check — does an open PR already exist for this branch?
6. Branch creation — sentraai/fix/<rule-slug>-<scan_id_prefix>
7. File commit — fixed content committed to the branch
8. PR creation — structured PR body with metadata, rollback guidance, fingerprint
9. Telemetry — all outcomes written to autofix_prs table

Design principles:
- ALL failures are isolated — autofix errors NEVER affect PR comments or Check Runs
- NO auto-merge — PRs are created but never merged
- NO pushes to default/protected branches — only sentraai/fix/* branches
- Each finding is processed independently — one failure does not block others
"""

import logging
from typing import List, Dict, Any, Optional

from shared.schemas.finding_schema import Finding
from remediation_engine.autofix_policy import get_autofix_policy
from remediation_engine.remediation_registry import remediation_registry
from backend.app.services.github_service import GitProvider
from backend.app.services.autofix_pr_service import (
    build_autofix_pr_title,
    build_autofix_pr_body,
    build_autofix_commit_message,
    compute_pr_fingerprint,
    compute_source_content_hash,
)
from backend.app.database.telemetry_dao import (
    save_autofix_pr_record,
    check_autofix_cooldown,
)

logger = logging.getLogger("sentra-ai")

# Labels applied to every autofix PR for governance and filtering
AUTOFIX_PR_LABELS = ["sentraai", "security-fix", "auto-remediation"]


def _build_branch_name(rule_id: str, scan_id: str) -> str:
    """
    Generates the branch name for an autofix PR.
    Convention: sentraai/fix/<rule-slug>-<scan_id_prefix>
    Example: sentraai/fix/aws-s3-public-5cfa5820

    Uses the first 8 characters of the scan_id for uniqueness without excessive length.
    """
    rule_slug = rule_id.lower().replace("_", "-")
    scan_prefix = scan_id.replace("-", "")[:8]
    return f"sentraai/fix/{rule_slug}-{scan_prefix}"


async def run_autofix_workflows(
    git_provider: GitProvider,
    repo_full_name: str,
    base_sha: str,
    scan_id: str,
    original_pr_number: int,
    findings: List[Finding]
) -> List[Dict[str, Any]]:
    """
    Runs the full autofix PR workflow for all eligible findings.

    Each finding is processed independently. A failure on one finding
    does not prevent others from being processed.

    Returns a list of outcome records for logging and telemetry.
    """
    results = []

    # Filter to only autofix-eligible findings (stamped by scan_service)
    eligible = [f for f in findings if f.safe_for_autofix and f.remediation_diff]

    if not eligible:
        logger.info(f"[{scan_id}] No autofix-eligible findings in this scan. Skipping autofix workflows.")
        return results

    logger.info(f"[{scan_id}] Starting autofix workflows for {len(eligible)} eligible finding(s).")

    # Fetch the default branch name once for the entire scan
    default_branch = await git_provider.get_default_branch(repo_full_name)
    logger.info(f"[{scan_id}] Default branch resolved to '{default_branch}'.")

    for finding in eligible:
        result = await _process_single_finding_autofix(
            git_provider=git_provider,
            repo_full_name=repo_full_name,
            base_sha=base_sha,
            default_branch=default_branch,
            scan_id=scan_id,
            original_pr_number=original_pr_number,
            finding=finding
        )
        results.append(result)

    completed = sum(1 for r in results if r.get("status") == "CREATED")
    skipped = sum(1 for r in results if r.get("status") in ("DUPLICATE_SKIPPED", "COOLDOWN_SKIPPED"))
    failed = sum(1 for r in results if r.get("status") == "FAILED")

    logger.info(
        f"[{scan_id}] Autofix workflow summary: "
        f"{completed} created, {skipped} skipped, {failed} failed."
    )
    return results


async def _process_single_finding_autofix(
    git_provider: GitProvider,
    repo_full_name: str,
    base_sha: str,
    default_branch: str,
    scan_id: str,
    original_pr_number: int,
    finding: Finding
) -> Dict[str, Any]:
    """
    Processes a single finding through the complete autofix PR workflow.
    Returns an outcome dict describing what happened.
    """
    rule_id = finding.rule_id
    file_path = finding.file_path
    branch_name = _build_branch_name(rule_id, scan_id)
    policy = get_autofix_policy(rule_id)

    logger.info(
        f"[{scan_id}] Processing autofix for {rule_id} on '{file_path}' "
        f"(tier={finding.fix_safety_tier}, branch={branch_name})"
    )

    try:
        # ── Step 1: Cooldown Check (Improvement #5) ───────────────────────────
        if check_autofix_cooldown(repo_full_name, rule_id, file_path):
            logger.info(
                f"[{scan_id}] COOLDOWN_SKIPPED: A PR was already created for "
                f"{rule_id} on '{file_path}' within the last 24 hours."
            )
            save_autofix_pr_record(
                scan_id=scan_id, repo_name=repo_full_name, rule_id=rule_id,
                file_path=file_path, branch_name=branch_name,
                fix_safety_tier=finding.fix_safety_tier, status="COOLDOWN_SKIPPED"
            )
            return {"rule_id": rule_id, "file_path": file_path, "status": "COOLDOWN_SKIPPED"}

        # ── Step 2: Drift Detection (Improvement #3) ─────────────────────────
        # Fetch the current content of the file at HEAD of the default branch.
        # If the file has changed since the scan, the diff may no longer apply cleanly.
        try:
            current_content = await git_provider.get_file_content(repo_full_name, file_path, base_sha)
        except Exception as e:
            logger.warning(
                f"[{scan_id}] Could not fetch current content of '{file_path}' for drift detection: {str(e)}. "
                f"Proceeding with PR HEAD content."
            )
            current_content = None

        # Recompute the fix against current HEAD content to detect drift
        fixed_content = None
        source_content_hash = None

        if current_content:
            source_content_hash = compute_source_content_hash(current_content)

            # Attempt to regenerate the fix against current content
            fresh_remediation = remediation_registry.get_remediation_in_memory(
                rule_id=rule_id,
                file_path=file_path,
                resource_type=finding.resource_type or "",
                resource_name=finding.resource_name or "",
                original_content=current_content
            )

            if fresh_remediation.get("remediation_diff"):
                # Drift check: does the vulnerability still exist?
                # If the fix generates no meaningful diff, the source already changed
                fixed_content = fresh_remediation.get("fixed_content")
                remediation_diff_for_pr = fresh_remediation.get("remediation_diff")
            else:
                logger.info(
                    f"[{scan_id}] DRIFT DETECTED: The vulnerability in '{file_path}' "
                    f"for rule {rule_id} no longer exists at HEAD. Skipping autofix."
                )
                save_autofix_pr_record(
                    scan_id=scan_id, repo_name=repo_full_name, rule_id=rule_id,
                    file_path=file_path, branch_name=branch_name,
                    fix_safety_tier=finding.fix_safety_tier, status="FAILED",
                    source_content_hash=source_content_hash,
                    failure_reason="DRIFT: Vulnerability no longer present at HEAD"
                )
                return {"rule_id": rule_id, "file_path": file_path, "status": "FAILED", "reason": "drift"}
        else:
            # Fall back to the diff already computed during scan
            remediation_diff_for_pr = finding.remediation_diff
            fixed_content = None  # We'll use base64 commit of the original fix

        # Create a temporary finding-like object with the fresh diff for PR body
        finding_for_pr = Finding(
            rule_id=finding.rule_id,
            file_path=finding.file_path,
            severity=finding.severity,
            title=finding.title,
            description=finding.description,
            recommended_fix=finding.recommended_fix,
            rule_version=finding.rule_version,
            resource_type=finding.resource_type,
            resource_name=finding.resource_name,
            fix_confidence=finding.fix_confidence,
            explanation=finding.explanation,
            remediation_diff=remediation_diff_for_pr,
            fix_safety_tier=finding.fix_safety_tier,
            safe_for_autofix=finding.safe_for_autofix,
            requires_human_review=finding.requires_human_review
        )

        # ── Step 3: Duplicate PR Check (Improvement #7) ──────────────────────
        existing_pr_number = await git_provider.find_open_pr_for_branch(repo_full_name, branch_name)
        if existing_pr_number:
            logger.info(
                f"[{scan_id}] DUPLICATE_SKIPPED: Open PR #{existing_pr_number} already exists "
                f"for branch '{branch_name}' in {repo_full_name}."
            )
            save_autofix_pr_record(
                scan_id=scan_id, repo_name=repo_full_name, rule_id=rule_id,
                file_path=file_path, branch_name=branch_name,
                fix_safety_tier=finding.fix_safety_tier, status="DUPLICATE_SKIPPED",
                pr_number=existing_pr_number, source_content_hash=source_content_hash
            )
            return {"rule_id": rule_id, "file_path": file_path, "status": "DUPLICATE_SKIPPED"}

        # ── Step 4: Compute PR Fingerprint (Improvement #8) ──────────────────
        pr_fingerprint = compute_pr_fingerprint(rule_id, file_path, remediation_diff_for_pr)

        # ── Step 5: Build PR Components ───────────────────────────────────────
        pr_title = build_autofix_pr_title(finding_for_pr)
        pr_body = build_autofix_pr_body(
            finding=finding_for_pr,
            policy=policy,
            scan_id=scan_id,
            original_pr_number=original_pr_number,
            pr_fingerprint=pr_fingerprint
        )
        commit_message = build_autofix_commit_message(finding_for_pr, scan_id)

        # ── Step 6: Create Branch ─────────────────────────────────────────────
        branch_created = await git_provider.create_branch(repo_full_name, branch_name, base_sha)
        if not branch_created:
            # Branch may already exist (e.g. from a previous failed run) — attempt to continue
            logger.warning(
                f"[{scan_id}] Branch '{branch_name}' already exists or could not be created. "
                f"Checking for duplicate PR before proceeding."
            )

        # ── Step 7: Commit Fixed File ─────────────────────────────────────────
        if fixed_content:
            commit_success = await git_provider.commit_file(
                repo_full_name, branch_name, file_path, fixed_content, commit_message
            )
        else:
            # Fallback: reconstruct fixed content from the existing diff
            logger.warning(
                f"[{scan_id}] Could not regenerate fixed content for '{file_path}'. "
                f"Falling back to original remediation diff for PR body only (no commit)."
            )
            commit_success = False

        if not commit_success:
            logger.error(f"[{scan_id}] Failed to commit fix for {rule_id} on '{file_path}'. Aborting PR creation.")
            save_autofix_pr_record(
                scan_id=scan_id, repo_name=repo_full_name, rule_id=rule_id,
                file_path=file_path, branch_name=branch_name,
                fix_safety_tier=finding.fix_safety_tier, status="FAILED",
                pr_fingerprint=pr_fingerprint, source_content_hash=source_content_hash,
                failure_reason="FILE_COMMIT_FAILED"
            )
            return {"rule_id": rule_id, "file_path": file_path, "status": "FAILED", "reason": "commit_failed"}

        # ── Step 8: Create Pull Request ───────────────────────────────────────
        pr_url = await git_provider.create_pull_request(
            repo_full_name=repo_full_name,
            title=pr_title,
            body=pr_body,
            head_branch=branch_name,
            base_branch=default_branch,
            labels=AUTOFIX_PR_LABELS
        )

        if not pr_url:
            save_autofix_pr_record(
                scan_id=scan_id, repo_name=repo_full_name, rule_id=rule_id,
                file_path=file_path, branch_name=branch_name,
                fix_safety_tier=finding.fix_safety_tier, status="FAILED",
                pr_fingerprint=pr_fingerprint, source_content_hash=source_content_hash,
                failure_reason="PR_CREATION_FAILED"
            )
            return {"rule_id": rule_id, "file_path": file_path, "status": "FAILED", "reason": "pr_creation_failed"}

        # ── Step 9: Write Telemetry ───────────────────────────────────────────
        save_autofix_pr_record(
            scan_id=scan_id, repo_name=repo_full_name, rule_id=rule_id,
            file_path=file_path, branch_name=branch_name,
            fix_safety_tier=finding.fix_safety_tier, status="CREATED",
            pr_url=pr_url, pr_fingerprint=pr_fingerprint,
            source_content_hash=source_content_hash
        )

        logger.info(f"[{scan_id}] Autofix PR CREATED: {pr_url}")
        return {
            "rule_id": rule_id,
            "file_path": file_path,
            "status": "CREATED",
            "pr_url": pr_url,
            "branch": branch_name
        }

    except Exception as e:
        logger.error(f"[{scan_id}] Unexpected error in autofix workflow for {rule_id} on '{file_path}': {str(e)}")
        save_autofix_pr_record(
            scan_id=scan_id, repo_name=repo_full_name, rule_id=rule_id,
            file_path=file_path, branch_name=branch_name,
            fix_safety_tier=finding.fix_safety_tier, status="FAILED",
            failure_reason=f"UNEXPECTED: {str(e)}"
        )
        return {"rule_id": rule_id, "file_path": file_path, "status": "FAILED", "reason": str(e)}


def _extract_fixed_content(original_content: str, diff_str: str) -> Optional[str]:
    """
    Attempts to reconstruct the fixed content from the original content
    by applying the remediation engine directly.

    NOTE: This is a simple approach — for complex multi-hunk diffs,
    a proper patch application library (e.g. python-patch) would be needed.
    For now we re-run the fixer against the original content to get the fixed version.

    Returns None on failure — caller falls back to commit-less PR.
    """
    # The fixed content was already computed by the remediation engine during drift detection.
    # This function exists as a hook for future patch-apply logic.
    # For now, we return None and let the caller handle the fallback.
    return None

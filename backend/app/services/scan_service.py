import os
import sys
import uuid
import time
import logging
from typing import List, Dict, Any, Tuple
from shared.schemas.finding_schema import Finding
from scanner_engine.parsers.tf_parser import parse_tf_string, ParseError
from scanner_engine.parsers.ignore_parser import parse_ignore_annotations
from scanner_engine.rule_registry import registry
from remediation_engine.remediation_registry import remediation_registry
from backend.app.services.github_service import GitProvider
from backend.app.database.telemetry_dao import save_scan_telemetry, save_suppression_audit
from remediation_engine.autofix_policy import get_autofix_policy
from backend.app.config import MAX_FILE_SIZE_BYTES, MAX_PR_FILES, SCAN_TIMEOUT_SECONDS

logger = logging.getLogger("sentra-ai")

async def scan_pr_files(
    git_provider: GitProvider,
    repo_full_name: str,
    pr_number: int,
    sha: str
) -> Tuple[str, str, List[Finding], List[Dict[str, Any]], Dict[str, float]]:
    """
    Coordinates scanning of changed files in a pull request.
    Downloads files in-memory, parses ignore annotations, filters findings,
    executes remediation in-memory, tracks performance metrics, and logs trace
    details persistently to SQLite.
    
    Returns a tuple of (scan_id, status, active_findings, suppressed_findings, metrics).
    """
    scan_id = str(uuid.uuid4())
    start_time = time.time()
    
    logger.info(f"[{scan_id}] Initializing scan for repository: {repo_full_name}, PR: #{pr_number}, Head SHA: {sha}")
    
    metrics = {
        "parse_time": 0.0,
        "scan_time": 0.0,
        "remediation_time": 0.0,
        "total_time": 0.0
    }
    
    findings: List[Finding] = []
    suppressed_findings: List[Dict[str, Any]] = []
    status = "PENDING"
    
    try:
        status = "RUNNING"
        # 1. Fetch files list from GitProvider
        changed_files = await git_provider.get_pr_files(repo_full_name, pr_number, sha)
        
        # 2. Filter files for *.tf and *.tfvars extensions only
        tf_files = [
            f for f in changed_files 
            if f.get("filename", "").endswith((".tf", ".tfvars"))
            and f.get("status") != "removed"
        ]
        
        if not tf_files:
            logger.info(f"[{scan_id}] No Terraform configuration files modified in this PR.")
            status = "COMPLETED"
            metrics["total_time"] = time.time() - start_time
            # Write empty telemetry log
            save_scan_telemetry(scan_id, repo_full_name, pr_number, sha, status, 0, 0, 0.0, 0.0, 0.0, metrics["total_time"])
            return scan_id, status, findings, suppressed_findings, metrics

        # 3. Enforce maximum PR file count limits
        if len(tf_files) > MAX_PR_FILES:
            logger.warning(f"[{scan_id}] PR contains {len(tf_files)} changed HCL files, exceeding safety limit of {MAX_PR_FILES}. Aborting scan.")
            status = "FAILED_EXCEEDED_LIMITS"
            metrics["total_time"] = time.time() - start_time
            save_scan_telemetry(scan_id, repo_full_name, pr_number, sha, status, 0, 0, 0.0, 0.0, 0.0, metrics["total_time"])
            return scan_id, status, [], [], metrics

        partial_failures = False
        outcome_category = "COMPLETED"
        
        # 4. Scan files in-memory
        for file_meta in tf_files:
            filename = file_meta.get("filename", "")
            
            try:
                # Enforce scan timeouts
                elapsed = time.time() - start_time
                if elapsed > SCAN_TIMEOUT_SECONDS:
                    logger.error(f"[{scan_id}] Scan timeout exceeded ({SCAN_TIMEOUT_SECONDS}s). Halting scanner execution.")
                    outcome_category = "PARTIAL_TIMEOUT"
                    partial_failures = True
                    break

                logger.info(f"[{scan_id}] Downloading file content in-memory: {filename}")
                file_content = await git_provider.get_file_content(repo_full_name, filename, sha)
                
                # Enforce file size limit
                content_bytes = file_content.encode("utf-8")
                if len(content_bytes) > MAX_FILE_SIZE_BYTES:
                    logger.warning(f"[{scan_id}] File {filename} size ({len(content_bytes)} bytes) exceeds max limit of {MAX_FILE_SIZE_BYTES} bytes. Skipping.")
                    partial_failures = True
                    continue

                # Parse HCL string
                parse_start = time.time()
                parsed_data = parse_tf_string(file_content)
                metrics["parse_time"] += time.time() - parse_start
                
                # Parse rule suppressions annotations (ignore comments)
                ignore_map = parse_ignore_annotations(file_content)
                
                # Execute security rules
                scan_start = time.time()
                rules = registry.get_all_rules()
                file_findings: List[Finding] = []
                for rule in rules:
                    rule_findings = rule.check(parsed_data, filename)
                    # Stamp rule version dynamically
                    for f in rule_findings:
                        f.rule_version = rule.version
                    file_findings.extend(rule_findings)
                metrics["scan_time"] += time.time() - scan_start
                
                # 5. Filter suppressed findings block-by-block
                active_findings: List[Finding] = []
                for f in file_findings:
                    resource_key = f"{f.resource_type}.{f.resource_name}"
                    if resource_key in ignore_map and f.rule_id in ignore_map[resource_key]:
                        reason = ignore_map[resource_key][f.rule_id]
                        suppressed_findings.append({
                            "rule_id": f.rule_id,
                            "resource": resource_key,
                            "reason": reason,
                            "severity": f.severity.value,
                            "file_path": filename
                        })
                        logger.info(f"[{scan_id}] Suppressed finding {f.rule_id} for resource {resource_key} (Reason: {reason})")
                    else:
                        active_findings.append(f)
                
                # 6. Fetch remediations & diffs for active findings only
                remediation_start = time.time()
                for finding in active_findings:
                    if finding.resource_type and finding.resource_name:
                        remediation = remediation_registry.get_remediation_in_memory(
                            finding.rule_id,
                            filename,
                            finding.resource_type,
                            finding.resource_name,
                            file_content
                        )
                        if remediation:
                            finding.remediation_type = remediation.get("remediation_type")
                            finding.remediation_mode = remediation.get("remediation_mode")
                            finding.fix_confidence = remediation.get("fix_confidence", 1.0)
                            finding.remediation_diff = remediation.get("remediation_diff")
                            finding.explanation = remediation.get("explanation")

                        # Stamp autofix policy fields from the centralized policy matrix
                        autofix_policy = get_autofix_policy(finding.rule_id)
                        finding.safe_for_autofix = autofix_policy.safe_for_autofix
                        finding.requires_human_review = autofix_policy.requires_human_review
                        finding.fix_safety_tier = autofix_policy.fix_safety_tier
                metrics["remediation_time"] += time.time() - remediation_start
                
                findings.extend(active_findings)

                # 7. Create inline PR review comments
                repo_owner, repo_name = repo_full_name.split("/")

                for finding in active_findings:

                    try:
                        if not finding.line_number:
                            continue

                        severity_emoji = {
                            "CRITICAL": "🚨",
                            "HIGH": "⚠️",
                            "MEDIUM": "🟡",
                            "LOW": "🔵"
                        }.get(finding.severity.value, "⚠️")

                        explanation = ""

                        if finding.explanation:
                            explanation = finding.explanation.get(
                                "why_it_matters",
                                ""
                            )

                        comment_body = f"""
{severity_emoji} **{finding.severity.value} Security Finding**

**Rule:** `{finding.rule_id}`

**Description:** {finding.description}

**Why this matters:**  
{explanation}

**Recommended Fix:**  
{finding.recommended_fix}

**Confidence:** {finding.fix_confidence}
"""

                        await git_provider.create_inline_pr_comment(
                            repo_owner=repo_owner,
                            repo_name=repo_name,
                            pull_number=pr_number,
                            commit_id=sha,
                            path=filename,
                            line=finding.line_number,
                            body=comment_body
                        )

                        logger.info(
                            f"[{scan_id}] Inline PR comment created "
                            f"for {finding.rule_id} "
                            f"on line {finding.line_number}"
                        )

                    except Exception as comment_error:
                        logger.warning(
                            f"[{scan_id}] Failed to create inline comment: "
                            f"{str(comment_error)}"
                        )

                
            except ParseError as pe:
                logger.error(f"[{scan_id}] Parser error scanning file {filename}: {str(pe)}")
                outcome_category = "PARTIAL_PARSE_ERROR"
                partial_failures = True
                continue
            except Exception as e:
                logger.error(f"[{scan_id}] Error scanning file {filename}: {str(e)}")
                partial_failures = True
                continue

        # Determine final status
        if outcome_category.startswith("PARTIAL") or partial_failures:
            status = outcome_category if outcome_category.startswith("PARTIAL") else "PARTIAL"
        else:
            status = "COMPLETED"
            
    except Exception as e:
        logger.error(f"[{scan_id}] Critical failure in scan orchestrator: {str(e)}")
        status = "FAILED"
        
    metrics["total_time"] = time.time() - start_time
    
    # 7. Write telemetry persistently
    save_scan_telemetry(
        scan_id=scan_id,
        repo_name=repo_full_name,
        pr_number=pr_number,
        head_sha=sha,
        status=status,
        findings_count=len(findings),
        suppressed_count=len(suppressed_findings),
        parse_time=metrics["parse_time"],
        scan_time=metrics["scan_time"],
        remediation_time=metrics["remediation_time"],
        total_time=metrics["total_time"]
    )

    # 8. Write per-rule suppression audit records for product intelligence telemetry
    save_suppression_audit(
        scan_id=scan_id,
        repo_name=repo_full_name,
        suppressed_findings=suppressed_findings
    )

    return scan_id, status, findings, suppressed_findings, metrics

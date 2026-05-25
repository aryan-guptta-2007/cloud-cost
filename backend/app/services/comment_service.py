import os
import sys
from typing import List, Dict
from shared.schemas.finding_schema import Finding
from shared.constants.comment_signature import COMMENT_SIGNATURE

def build_pr_comment_body(
    scan_id: str,
    status: str,
    findings: List[Finding],
    metrics: Dict[str, float]
) -> str:
    """
    Compiles security scan results, performance timings, and tracing IDs
    into a clean markdown comment for GitHub pull request delivery.
    """
    lines = [
        COMMENT_SIGNATURE,
        "# SentraAI Security Review",
        ""
    ]

    # Fail-safe warning notifications
    if status == "PARTIAL":
        lines.append("> [!WARNING]")
        lines.append("> **Partial Scan Completed**: Some files were skipped due to size limits, timeouts, or HCL parse failures.")
        lines.append("")
    elif status == "FAILED":
        lines.append("> [!CAUTION]")
        lines.append("> **Scan Failed**: The scanner encountered a critical system execution error.")
        lines.append("")
        lines.append(f"**Trace ID (Scan ID)**: `{scan_id}`")
        return "\n".join(lines)

    # 1. Findings count stats summary
    critical_count = sum(1 for f in findings if f.severity.value == "CRITICAL")
    high_count = sum(1 for f in findings if f.severity.value == "HIGH")
    medium_count = sum(1 for f in findings if f.severity.value == "MEDIUM")
    low_count = sum(1 for f in findings if f.severity.value == "LOW")
    
    total_issues = len(findings)
    
    if total_issues == 0:
        lines.append("### [+] Status: Compliant")
        lines.append("No security vulnerabilities or misconfigurations detected in the modified Terraform code.")
    else:
        lines.append("### [!] Status: Actions Required")
        lines.append(f"Detected **{total_issues}** security findings in the changed Terraform files:")
        lines.append(f"- **{critical_count}** Critical")
        lines.append(f"- **{high_count}** High")
        if (medium_count + low_count) > 0:
            lines.append(f"- **{medium_count + low_count}** Medium/Low")
    lines.append("")

    # 2. Detailed findings mapping
    max_visible_findings = 10
    visible_findings = findings[:max_visible_findings]
    
    for idx, finding in enumerate(visible_findings):
        severity_val = finding.severity.value
        lines.append(f"### {idx+1}. [{severity_val}] {finding.rule_id} - {finding.title}")
        lines.append(f"* **File**: `{finding.file_path}`")
        if finding.resource_type:
            lines.append(f"* **Resource**: `{finding.resource_type}.{finding.resource_name}`")
        lines.append("")
        
        # Format structured explanation copy
        if finding.explanation:
            lines.append(f"**Risk Summary**:\n{finding.explanation.get('risk_summary')}\n")
            lines.append(f"**Why It Matters**:\n{finding.explanation.get('why_it_matters')}\n")
            lines.append(f"**Recommended Action**:\n{finding.explanation.get('recommended_action')}\n")
        else:
            lines.append(f"**Description**:\n{finding.description}\n")

        lines.append(f"**Remediation Strategy**: `{finding.remediation_type}` (Confidence: {finding.fix_confidence})")
        lines.append(f"**Fix Recommendation**: {finding.recommended_fix}")
        lines.append("")
        
        # Display collapsible code patches
        if finding.remediation_diff:
            lines.append("<details>")
            lines.append("<summary>🛠️ View Suggested Remediation Diff</summary>")
            lines.append("")
            lines.append("```diff")
            lines.append(finding.remediation_diff.strip())
            lines.append("```")
            lines.append("</details>")
        else:
            lines.append("> [!NOTE]")
            lines.append(f"> This check requires manual review. Automated diff is not available for strategy `{finding.remediation_type}`.")
        
        lines.append("")
        lines.append("---")
        lines.append("")

    # Handle finding truncations to avoid giant comments
    if len(findings) > max_visible_findings:
        remaining = len(findings) - max_visible_findings
        lines.append(f"**...and {remaining} more finding(s) detected. Run scripts/scan.py locally to view all issues.**")
        lines.append("")
        lines.append("---")
        lines.append("")

    # 3. Telemetry and trace metrics footer
    lines.append("### Execution Metrics")
    lines.append(f"- **Scan Time**: `{metrics.get('scan_time', 0.0):.4f}s`")
    lines.append(f"- **Total Processing Time**: `{metrics.get('total_time', 0.0):.4f}s`")
    lines.append(f"- **Trace ID (Scan ID)**: `{scan_id}`")
    
    return "\n".join(lines)

import os
import sys
import argparse
from typing import List

# Ensure parent directory is in sys.path for monorepo imports
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from scanner_engine.parsers.tf_parser import parse_tf_file, ParseError
from scanner_engine.rule_registry import registry
from remediation_engine.remediation_registry import remediation_registry
from scanner_engine.outputs.json_output import format_findings_json
from shared.schemas.finding_schema import Finding

def main():
    parser = argparse.ArgumentParser(description="SentraAI Terraform Security Scanner CLI")
    parser.add_argument("path", help="Path to the Terraform file (.tf) to scan")
    parser.add_argument("--json", action="store_true", help="Output findings in JSON format")
    args = parser.parse_args()

    target_path = args.path

    try:
        # Step 1: Parse the Terraform file
        parsed_data = parse_tf_file(target_path)
    except ParseError as e:
        sys.stderr.write(f"Parser/System Error: {str(e)}\n")
        sys.exit(2)
    except Exception as e:
        sys.stderr.write(f"Unexpected System Error: {str(e)}\n")
        sys.exit(2)

    # Step 2: Run all registered rules
    all_findings: List[Finding] = []
    rules = registry.get_all_rules()

    for rule in rules:
        try:
            findings = rule.check(parsed_data, target_path)
            all_findings.extend(findings)
        except Exception as e:
            sys.stderr.write(f"Rule Execution Error [Rule ID: {rule.id}]: {str(e)}\n")
            sys.exit(2)

    # Step 3: Populate remediation and diff details
    for finding in all_findings:
        if finding.resource_type and finding.resource_name:
            remediation = remediation_registry.get_remediation(
                finding.rule_id,
                target_path,
                finding.resource_type,
                finding.resource_name
            )
            if remediation:
                finding.remediation_type = remediation.get("remediation_type")
                finding.remediation_mode = remediation.get("remediation_mode")
                finding.fix_confidence = remediation.get("fix_confidence", 1.0)
                finding.remediation_diff = remediation.get("remediation_diff")
                finding.explanation = remediation.get("explanation")

    # Step 4: Format and output results
    if args.json:
        print(format_findings_json(all_findings))
    else:
        if not all_findings:
            print("\n[+] Scan completed. No security findings detected.")
        else:
            print(f"\n[!] Scan completed. Found {len(all_findings)} security issue(s):\n")
            for finding in all_findings:
                severity_str = finding.severity.value
                print(f"[{severity_str}] {finding.rule_id} - {finding.title}")
                print(f"  File: {finding.file_path}")
                if finding.resource_type:
                    print(f"  Resource: {finding.resource_type}.{finding.resource_name}")
                if finding.line_number is not None:
                    print(f"  Line: {finding.line_number}")
                if finding.code_snippet:
                    print(f"  Snippet: {finding.code_snippet}")
                
                # Print structured explanation if populated
                if finding.explanation:
                    print("  Explanation:")
                    print(f"    Risk Summary: {finding.explanation.get('risk_summary')}")
                    print(f"    Why It Matters: {finding.explanation.get('why_it_matters')}")
                    print(f"    Recommended Action: {finding.explanation.get('recommended_action')}")
                else:
                    print(f"  Description: {finding.description}")

                print(f"  Remediation Strategy: {finding.remediation_type} (Confidence: {finding.fix_confidence})")
                print(f"  Fix Recommendation: {finding.recommended_fix}")
                
                if finding.remediation_diff:
                    print("  Auto-generated Terraform diff:")
                    diff_lines = finding.remediation_diff.splitlines()
                    for line in diff_lines:
                        # Strip trailing newlines from print
                        print(f"    {line.rstrip()}")
                print("-" * 60)

    # Step 5: Exit code based on finding status
    if all_findings:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()

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

    # Step 3: Format and output results
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
                if finding.line_number is not None:
                    print(f"  Line: {finding.line_number}")
                if finding.code_snippet:
                    print(f"  Snippet: {finding.code_snippet}")
                print(f"  Description: {finding.description}")
                print(f"  Fix: {finding.recommended_fix}")
                print(f"  Confidence: {finding.confidence}")
                print("-" * 60)

    # Step 4: Exit code based on finding status
    if all_findings:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()

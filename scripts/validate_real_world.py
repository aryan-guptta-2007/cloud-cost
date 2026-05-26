#!/usr/bin/env python3
"""
scripts/validate_real_world.py

This script performs real-world validation of SentraAI's scanning, safety, 
remediation, and validation pipeline. It scans the intentionally vulnerable 
insecure.tf configuration, applies remediation patches, and validates the 
fixes against all 3 safety layers:
  1. HCL Syntax Check
  2. Terraform CLI Validate (if installed)
  3. AST Resource Boundary check
"""

import os
import sys

# Ensure parent directory is in sys.path for monorepo imports
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from scanner_engine.parsers.tf_parser import parse_tf_file, ParseError
from scanner_engine.rule_registry import registry
from remediation_engine.remediation_registry import remediation_registry
from remediation_engine.autofix_policy import get_autofix_policy
from remediation_engine.validators.syntax_validator import (
    validate_tf_syntax,
    validate_via_terraform_cli,
    validate_resource_boundary
)

def run_validation():
    insecure_tf_path = os.path.join(BASE_DIR, "examples", "insecure", "insecure.tf")
    print("=" * 80)
    print(" SENTRAAI REAL-WORLD REMEDIATION VALIDATION RUNNER")
    print("=" * 80)
    print(f"Target File: {insecure_tf_path}\n")

    if not os.path.exists(insecure_tf_path):
        print(f"[-] Error: Target file {insecure_tf_path} does not exist.")
        sys.exit(1)

    # 1. Parse HCL
    print("[1/5] Parsing HCL configuration...")
    try:
        parsed_data = parse_tf_file(insecure_tf_path)
        print("  -> AST loaded successfully.\n")
    except ParseError as e:
        print(f"  -> Parse Error: {e}")
        sys.exit(1)

    # 2. Run Scanner Rules
    print("[2/5] Running security rules...")
    all_findings = []
    rules = registry.get_all_rules()
    for rule in rules:
        findings = rule.check(parsed_data, insecure_tf_path)
        all_findings.extend(findings)
        print(f"  -> Rule {rule.id}: Identified {len(findings)} finding(s).")
    print(f"  -> Total findings identified: {len(all_findings)}\n")

    # 3. Retrieve original file content
    with open(insecure_tf_path, "r", encoding="utf-8") as f:
        original_content = f.read()

    # 4. Process Remediation and 3-Layer Validation
    print("[3/5] Simulating remediation and running 3-Layer Validation...")
    remediation_results = []
    
    for finding in all_findings:
        rule_id = finding.rule_id
        res_type = finding.resource_type
        res_name = finding.resource_name
        policy = get_autofix_policy(rule_id)
        
        print(f"\n  Analyzing Finding: {rule_id} on {res_type}.{res_name}")
        print(f"    - Policy Allowed: {'YES' if policy.autofix_allowed else 'NO'}")
        print(f"    - Safety Tier: {policy.fix_safety_tier}")
        print(f"    - Human Review Required: {'YES' if policy.requires_human_review else 'NO'}")

        if not policy.autofix_allowed:
            print("    - Status: [SKIPPED] Rule is not eligible for auto-fix.")
            remediation_results.append({
                "rule_id": rule_id,
                "resource": f"{res_type}.{res_name}",
                "safety_tier": policy.fix_safety_tier,
                "allowed": False,
                "syntax": "N/A",
                "cli_validate": "N/A",
                "ast_boundary": "N/A",
                "diff": None,
                "status": "REFUSED_BY_POLICY"
            })
            continue

        # Dry-run fixing in-memory
        rem_res = remediation_registry.get_remediation_in_memory(
            rule_id, insecure_tf_path, res_type, res_name, original_content
        )
        
        modified_content = rem_res.get("fixed_content")
        
        if not modified_content:
            print(f"    - Status: [FAILED] Remediation generation failed: {rem_res.get('validation_status')}")
            remediation_results.append({
                "rule_id": rule_id,
                "resource": f"{res_type}.{res_name}",
                "safety_tier": policy.fix_safety_tier,
                "allowed": True,
                "syntax": "FAILED",
                "cli_validate": "N/A",
                "ast_boundary": "N/A",
                "diff": None,
                "status": "GENERATION_FAILED"
            })
            continue

        # Run 3-Layer checks
        # Layer 1: HCL Syntax check (already run inside registry, but we do it explicitly here too)
        syntax_ok, syntax_err = validate_tf_syntax(modified_content)
        syntax_status = "PASSED" if syntax_ok else f"FAILED: {syntax_err}"

        # Layer 2: Terraform CLI validation
        cli_ok, cli_msg = validate_via_terraform_cli(modified_content)
        if not cli_ok:
            cli_status = f"FAILED: {cli_msg}"
        elif "warning: environment not initialized" in cli_msg.lower():
            cli_status = "PASSED (Skipped Init)"
        elif "not found in PATH" in cli_msg:
            cli_status = "PASSED (CLI Missing)"
        else:
            cli_status = "PASSED"

        # Layer 3: AST Resource Boundary Check
        ast_ok, ast_err = validate_resource_boundary(original_content, modified_content, res_type, res_name)
        ast_status = "PASSED" if ast_ok else f"FAILED: {ast_err}"

        all_passed = syntax_ok and cli_ok and ast_ok
        status_label = "PASSED" if all_passed else "REJECTED_VALIDATION"

        print(f"    - Layer 1 (HCL Syntax): {syntax_status}")
        print(f"    - Layer 2 (CLI Validate): {cli_status}")
        print(f"    - Layer 3 (AST Boundary): {ast_status}")
        print(f"    - Overall Safety Validation: {status_label}")

        remediation_results.append({
            "rule_id": rule_id,
            "resource": f"{res_type}.{res_name}",
            "safety_tier": policy.fix_safety_tier,
            "allowed": True,
            "syntax": syntax_status,
            "cli_validate": cli_status,
            "ast_boundary": ast_status,
            "diff": rem_res.get("remediation_diff"),
            "status": status_label
        })

    # 5. Output Summary Report Table
    print("\n" + "=" * 80)
    print(" FINAL SECURITY REMEDIATION SUMMARY REPORT")
    print("=" * 80)
    print(f"{'Rule ID':<20} | {'Resource':<30} | {'Safety Tier':<15} | {'Overall Status'}")
    print("-" * 80)
    for r in remediation_results:
        print(f"{r['rule_id']:<20} | {r['resource']:<30} | {r['safety_tier']:<15} | {r['status']}")
    print("=" * 80)

    # Output diff files for passed fixes
    print("\n[5/5] Unified Diff Previews of Remediated Resources:")
    for r in remediation_results:
        if r["diff"]:
            print(f"\n--- Unified Diff for {r['rule_id']} on {r['resource']} ---")
            lines = r["diff"].splitlines()
            for line in lines:
                print(f"  {line}")
            print("-" * 60)

    print("\n[+] Validation runner run complete.")

if __name__ == "__main__":
    run_validation()

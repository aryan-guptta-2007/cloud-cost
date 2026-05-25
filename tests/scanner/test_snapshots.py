import os
import sys
import json
import subprocess
import pytest

# Paths relative to the monorepo root
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
INSECURE_TF = os.path.join(BASE_DIR, "examples", "insecure", "insecure.tf")
SNAPSHOT_DIR = os.path.join(BASE_DIR, "tests", "scanner", "snapshots")
SNAPSHOT_FILE = os.path.join(SNAPSHOT_DIR, "insecure_snapshot.json")

def run_scanner(filepath: str) -> list:
    """Executes the scripts/scan.py runner and returns parsed JSON findings."""
    python_exe = os.path.join(BASE_DIR, ".venv", "Scripts", "python.exe")
    if not os.path.exists(python_exe):
        python_exe = sys.executable

    script_path = os.path.join(BASE_DIR, "scripts", "scan.py")
    
    cmd = [python_exe, script_path, filepath, "--json"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    # Exit code 1 is expected as insecure.tf triggers findings
    assert result.returncode == 1, f"Scanner returned unexpected status code {result.returncode}. Stderr: {result.stderr}"
    return json.loads(result.stdout)

def test_insecure_scan_snapshot():
    """Validates findings count, severity, structured explanations, and diff content against a baseline snapshot."""
    findings = run_scanner(INSECURE_TF)
    
    # Sort findings by rule_id for consistent ordering
    findings = sorted(findings, key=lambda x: x["rule_id"])
    
    # Ensure snapshot directory exists
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    
    # Auto-generate baseline snapshot if missing
    if not os.path.exists(SNAPSHOT_FILE):
        with open(SNAPSHOT_FILE, "w", encoding="utf-8") as f:
            json.dump(findings, f, indent=2)
        pytest.fail(f"Snapshot baseline was not present. Created baseline at {SNAPSHOT_FILE}. Re-run test to verify.")
        
    with open(SNAPSHOT_FILE, "r", encoding="utf-8") as f:
        baseline = json.load(f)
        
    baseline = sorted(baseline, key=lambda x: x["rule_id"])
    
    # 1. Validate count matches
    assert len(findings) == len(baseline), f"Expected {len(baseline)} findings, got {len(findings)}."
    
    # 2. Validate structural content matches exactly
    for f, b in zip(findings, baseline):
        assert f["rule_id"] == b["rule_id"], f"Rule ID mismatch: {f['rule_id']} vs {b['rule_id']}"
        assert f["severity"] == b["severity"], f"Severity mismatch for {f['rule_id']}"
        assert f["title"] == b["title"], f"Title mismatch for {f['rule_id']}"
        assert f["resource_type"] == b["resource_type"], f"Resource type mismatch for {f['rule_id']}"
        assert f["resource_name"] == b["resource_name"], f"Resource name mismatch for {f['rule_id']}"
        assert f["remediation_type"] == b["remediation_type"], f"Remediation type mismatch for {f['rule_id']}"
        assert f["remediation_mode"] == b["remediation_mode"], f"Remediation mode mismatch for {f['rule_id']}"
        assert f["fix_confidence"] == b["fix_confidence"], f"Fix confidence mismatch for {f['rule_id']}"
        
        # Validate structured explanation keys and values
        assert f["explanation"] == b["explanation"], f"Explanation mismatch for {f['rule_id']}"
        
        # Validate exact unified diff lines (excluding file timestamp differences)
        f_diff = f["remediation_diff"]
        b_diff = b["remediation_diff"]
        
        assert f_diff == b_diff, f"Diff mismatch for {f['rule_id']}.\nFound:\n{f_diff}\nExpected:\n{b_diff}"

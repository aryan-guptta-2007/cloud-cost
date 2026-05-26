import os
import sys
import pytest
from unittest.mock import patch, MagicMock

parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from remediation_engine.validators.syntax_validator import (
    validate_tf_syntax,
    validate_via_terraform_cli,
    validate_resource_boundary,
)

# ── HCL Syntax Validation Tests ──────────────────────────────────────────────

def test_syntax_valid_hcl():
    content = """
    resource "aws_s3_bucket" "test" {
      bucket = "my-bucket"
      acl    = "private"
    }
    """
    is_valid, err = validate_tf_syntax(content)
    assert is_valid is True
    assert err == ""

def test_syntax_invalid_hcl_brace_mismatch():
    # Missing closing brace
    content = """
    resource "aws_s3_bucket" "test" {
      bucket = "my-bucket"
      acl    = "private"
    """
    is_valid, err = validate_tf_syntax(content)
    assert is_valid is False
    assert "brace mismatch" in err.lower()

def test_syntax_invalid_hcl_parser_error():
    # Invalid key-value assignment (missing '=')
    content = """
    resource "aws_s3_bucket" "test" {
      bucket "my-bucket"
    }
    """
    is_valid, err = validate_tf_syntax(content)
    assert is_valid is False
    assert "parser syntax error" in err.lower()


# ── Terraform CLI Validation Tests ───────────────────────────────────────────

@patch("remediation_engine.validators.syntax_validator.shutil.which")
def test_cli_validate_skipped_when_terraform_missing(mock_which):
    mock_which.return_value = None  # Terraform not found in PATH
    is_valid, msg = validate_via_terraform_cli("content")
    assert is_valid is True
    assert "not found in PATH" in msg

@patch("remediation_engine.validators.syntax_validator.shutil.which")
@patch("remediation_engine.validators.syntax_validator.subprocess.run")
def test_cli_validate_success(mock_run, mock_which):
    mock_which.return_value = "/usr/local/bin/terraform"
    
    # Mock subprocess run returning exit code 0
    mock_result = MagicMock()
    mock_result.returncode = 0
    mock_run.return_value = mock_result

    is_valid, err = validate_via_terraform_cli("resource {}")
    assert is_valid is True
    assert err == ""

@patch("remediation_engine.validators.syntax_validator.shutil.which")
@patch("remediation_engine.validators.syntax_validator.subprocess.run")
def test_cli_validate_failed_on_bad_syntax(mock_run, mock_which):
    mock_which.return_value = "/usr/local/bin/terraform"
    
    # Mock subprocess run returning exit code 1 with structural syntax error
    mock_result = MagicMock()
    mock_result.returncode = 1
    mock_result.stderr = "Error: Argument or block definition required here"
    mock_result.stdout = ""
    mock_run.return_value = mock_result

    is_valid, err = validate_via_terraform_cli("invalid content")
    assert is_valid is False
    assert "validation failed" in err.lower()

@patch("remediation_engine.validators.syntax_validator.shutil.which")
@patch("remediation_engine.validators.syntax_validator.subprocess.run")
def test_cli_validate_ignored_on_missing_init(mock_run, mock_which):
    mock_which.return_value = "/usr/local/bin/terraform"
    
    # Mock subprocess run returning exit code 1 with uninitialized provider error
    mock_result = MagicMock()
    mock_result.returncode = 1
    mock_result.stderr = "Error: Missing backend configuration or requires provider installation"
    mock_result.stdout = ""
    mock_run.return_value = mock_result

    is_valid, err = validate_via_terraform_cli("resource {}")
    assert is_valid is True
    assert "warning: environment not initialized" in err.lower()


# ── Resource Boundary Validation Tests ────────────────────────────────────────

def test_boundary_validation_happy_path():
    original = """
    resource "aws_s3_bucket" "public" {
      bucket = "my-bucket"
      acl    = "public-read"
    }

    resource "aws_db_instance" "test" {
      storage_encrypted = false
    }
    """
    
    # Only modifying aws_s3_bucket.public acl attribute
    modified = """
    resource "aws_s3_bucket" "public" {
      bucket = "my-bucket"
      acl    = "private"
    }

    resource "aws_db_instance" "test" {
      storage_encrypted = false
    }
    """

    is_valid, err = validate_resource_boundary(
        original, modified, "aws_s3_bucket", "public"
    )
    assert is_valid is True
    assert err == ""

def test_boundary_validation_violates_boundary_modifies_other_resource():
    original = """
    resource "aws_s3_bucket" "public" {
      bucket = "my-bucket"
      acl    = "public-read"
    }

    resource "aws_db_instance" "test" {
      storage_encrypted = false
    }
    """
    
    # Modifying both aws_s3_bucket.public acl AND aws_db_instance.test storage_encrypted!
    modified = """
    resource "aws_s3_bucket" "public" {
      bucket = "my-bucket"
      acl    = "private"
    }

    resource "aws_db_instance" "test" {
      storage_encrypted = true
    }
    """

    is_valid, err = validate_resource_boundary(
        original, modified, "aws_s3_bucket", "public"
    )
    assert is_valid is False
    assert "Changes detected outside targeted resource" in err

def test_boundary_validation_violates_boundary_adds_variable():
    original = """
    resource "aws_s3_bucket" "public" {
      bucket = "my-bucket"
      acl    = "public-read"
    }
    """
    
    # Adding a completely new variable block!
    modified = """
    resource "aws_s3_bucket" "public" {
      bucket = "my-bucket"
      acl    = "private"
    }

    variable "unauthorized_variable" {
      default = "malicious"
    }
    """

    is_valid, err = validate_resource_boundary(
        original, modified, "aws_s3_bucket", "public"
    )
    assert is_valid is False
    assert "Changes detected outside targeted resource" in err

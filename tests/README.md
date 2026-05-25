# SentraAI Automated Test Suite

Reliability is paramount for security tooling. This directory houses testing suites mapping directly to our services.

## Test Folders

* **`scanner/`**: Unit tests for Terraform parser and rule logic, validating that correct lines and vulnerabilities are reported.
* **`remediation/`**: Tests verifying template mappings, plain text descriptions, and syntax-accurate Git diff generation.
* **`backend/`**: Integration tests verifying webhook event validation, endpoint parsing, and worker queues.

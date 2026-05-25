# SentraAI Remediation Engine

This module generates explanation text and secure code diff suggestions for detected Terraform vulnerabilities.

## How It Works

1. Receives finding details from the Backend (e.g. `rule_id = "AWS_S3_PUBLIC"` and code context).
2. Maps the finding ID to pre-defined remediation templates.
3. Generates:
   * **Why Dangerous**: Detailed explanation of potential exploit vector.
   * **Recommended Fix**: Recommended action description.
   * **Unified Diff**: Clean git diff containing the replacement statements (e.g. Swapping `acl = "public-read"` for `acl = "private"`).
4. Returns the result formatted for markdown injection into GitHub review comments.

# SentraAI Scanner Engine

This engine parses Terraform files and runs them against a suite of static security rules.

## Core Folders

* **`terraform/`**: Handles loading, parsing, and structured representations of `.tf` files.
* **`rules/`**: The core rule definitions. Every rule is represented by a separate Python module implementing the detection interface.
* **`parsers/`**: Utilities for matching AST patterns, expressions, and properties.
* **`outputs/`**: Standardizes the findings reports into the JSON schema defined in `shared/schemas/finding.json`.

## Core Security Rules
1. **AWS_S3_PUBLIC**: Public S3 bucket access (`acl = "public-read"`).
2. **AWS_SG_OPEN**: Ingress open to `0.0.0.0/0` on sensitive ports.
3. **AWS_IAM_WILDCARD**: Wildcard permissions (`*`) in IAM policy statements.
4. **AWS_DB_UNENCRYPTED**: Databases without storage encryption enabled.

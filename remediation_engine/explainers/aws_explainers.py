from typing import Dict
from remediation_engine.explainers.base_explainer import BaseExplainer

class AwsS3PublicExplainer(BaseExplainer):
    """Explains risks of publicly exposed S3 buckets."""
    def explain(self) -> Dict[str, str]:
        return {
            "risk_summary": "S3 bucket configuration permits public read-access.",
            "why_it_matters": "Publicly accessible buckets allow anyone on the internet to list and download files. This frequently leads to severe data leaks, exposing client records, sensitive code, or database backups.",
            "recommended_action": "Modify the S3 bucket ACL to 'private' and ensure that S3 Public Access Blocks are enabled."
        }

class AwsSgOpenExplainer(BaseExplainer):
    """Explains risks of exposing sensitive ports to 0.0.0.0/0."""
    def explain(self) -> Dict[str, str]:
        return {
            "risk_summary": "Security group ingress rules allow wide-open ingress (0.0.0.0/0) on sensitive ports.",
            "why_it_matters": "Exposing ports like SSH (22), RDP (3389), or database endpoints (Postgres/MySQL) to the public internet makes them targets for constant automated scanning, brute-force attacks, and exploitation.",
            "recommended_action": "Restrict the CIDR blocks to specific trusted IP ranges (e.g., your office/VPN range) or require a bastion host."
        }

class AwsIamWildcardExplainer(BaseExplainer):
    """Explains risks of wildcard actions/resources in IAM policies."""
    def explain(self) -> Dict[str, str]:
        return {
            "risk_summary": "An IAM policy allows wildcard action '*' or resource '*' permissions with an 'Allow' effect.",
            "why_it_matters": "Unrestricted actions violate the principle of least privilege. If the credentials associated with this role or user are compromised, an attacker can gain full admin rights over your cloud resources.",
            "recommended_action": "Refine the policy by specifying explicit permissions (e.g. s3:GetObject) and target resource ARNs instead of '*'"
        }

class AwsDbUnencryptedExplainer(BaseExplainer):
    """Explains risks of unencrypted RDS database storage."""
    def explain(self) -> Dict[str, str]:
        return {
            "risk_summary": "The RDS database instance storage encryption is disabled.",
            "why_it_matters": "Data stored on unencrypted RDS instances (including underlying volumes, backups, and transaction logs) resides in plain text. If database snapshots are leaked or access keys are compromised, the raw data can be extracted directly.",
            "recommended_action": "Set the database 'storage_encrypted' parameter to true."
        }

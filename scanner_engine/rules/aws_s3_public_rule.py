from typing import List
from scanner_engine.rules.base_rule import BaseRule
from shared.constants.severity import Severity
from shared.constants.category import Category
from shared.schemas.finding_schema import Finding

class AwsS3PublicRule(BaseRule):
    """
    Checks if an S3 bucket resource block has public read or read-write access.
    """
    def __init__(self):
        super().__init__(
            id="AWS_S3_PUBLIC",
            severity=Severity.CRITICAL,
            title="Public S3 Bucket Detected",
            description="The S3 bucket is configured with a public access ACL, exposing its objects to the public internet.",
            recommended_fix="Change the S3 bucket ACL to 'private' or remove the public ACL attribute.",
            category=Category.STORAGE_SECURITY
        )

    def check(self, parsed_data: dict, file_path: str) -> List[Finding]:
        findings = []
        resources = parsed_data.get("resource", {})
        s3_buckets = resources.get("aws_s3_bucket", {})
        
        for name, config in s3_buckets.items():
            if not isinstance(config, dict):
                continue
            acl = config.get("acl")
            if acl in ["public-read", "public-read-write"]:
                findings.append(
                    Finding(
                        rule_id=self.id,
                        file_path=file_path,
                        severity=self.severity,
                        title=self.title,
                        description=self.description,
                        recommended_fix=self.recommended_fix,
                        code_snippet=f'acl = "{acl}"',
                        confidence=1.0
                    )
                )
        return findings

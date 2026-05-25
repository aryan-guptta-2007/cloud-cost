from typing import List
from scanner_engine.rules.base_rule import BaseRule
from shared.constants.severity import Severity
from shared.constants.category import Category
from shared.schemas.finding_schema import Finding

class AwsDbUnencryptedRule(BaseRule):
    """
    Checks if an RDS database instance resource has storage encryption disabled.
    """
    def __init__(self):
        super().__init__(
            id="AWS_DB_UNENCRYPTED",
            severity=Severity.HIGH,
            title="Database Storage Encryption Disabled",
            description="An RDS database instance has storage encryption disabled, exposing stored data to potential access risks.",
            recommended_fix="Set 'storage_encrypted = true' in the aws_db_instance resource block.",
            category=Category.DATABASE_SECURITY
        )

    def check(self, parsed_data: dict, file_path: str) -> List[Finding]:
        findings = []
        resources = parsed_data.get("resource", {})
        db_instances = resources.get("aws_db_instance", {})
        
        for name, config in db_instances.items():
            if not isinstance(config, dict):
                continue
            
            storage_encrypted = config.get("storage_encrypted")
            
            # Default behavior in AWS RDS is unencrypted storage if not specified (None or False)
            if storage_encrypted is False or storage_encrypted is None:
                snippet = "storage_encrypted = false" if storage_encrypted is False else "(storage_encrypted attribute missing)"
                findings.append(
                    Finding(
                        rule_id=self.id,
                        file_path=file_path,
                        severity=self.severity,
                        title=self.title,
                        description=f"RDS instance '{name}' does not have storage encryption enabled.",
                        recommended_fix=self.recommended_fix,
                        code_snippet=snippet,
                        confidence=1.0
                    )
                )
        return findings

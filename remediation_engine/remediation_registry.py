import os
from typing import Dict, Any
from shared.constants.remediation_type import RemediationType
from remediation_engine.explainers.aws_explainers import (
    AwsS3PublicExplainer,
    AwsSgOpenExplainer,
    AwsIamWildcardExplainer,
    AwsDbUnencryptedExplainer
)
from remediation_engine.fixers.aws_s3_public_fixer import AwsS3PublicFixer
from remediation_engine.fixers.aws_sg_open_fixer import AwsSgOpenFixer
from remediation_engine.fixers.aws_iam_wildcard_fixer import AwsIamWildcardFixer
from remediation_engine.fixers.aws_db_unencrypted_fixer import AwsDbUnencryptedFixer
from remediation_engine.diff_generators.diff_helper import generate_unified_diff

class RemediationMetadata:
    """Standardized metadata containing strategy parameters for a rule."""
    def __init__(self, remediation_type: RemediationType, fix_confidence: float, mode: str, explainer_class, fixer_class):
        self.remediation_type = remediation_type
        self.fix_confidence = fix_confidence
        self.mode = mode
        self.explainer = explainer_class()
        self.fixer = fixer_class()

class RemediationRegistry:
    """Registry managing active explanation and fixer modules."""
    def __init__(self):
        self._registry: Dict[str, RemediationMetadata] = {
            "AWS_S3_PUBLIC": RemediationMetadata(
                remediation_type=RemediationType.AUTO_FIX,
                fix_confidence=1.0,
                mode="SAFE",
                explainer_class=AwsS3PublicExplainer,
                fixer_class=AwsS3PublicFixer
            ),
            "AWS_SG_OPEN": RemediationMetadata(
                remediation_type=RemediationType.AUTO_FIX,
                fix_confidence=0.9,
                mode="SAFE",
                explainer_class=AwsSgOpenExplainer,
                fixer_class=AwsSgOpenFixer
            ),
            "AWS_IAM_WILDCARD": RemediationMetadata(
                remediation_type=RemediationType.MANUAL_REVIEW,
                fix_confidence=0.6,
                mode="SUGGESTIVE",
                explainer_class=AwsIamWildcardExplainer,
                fixer_class=AwsIamWildcardFixer
            ),
            "AWS_DB_UNENCRYPTED": RemediationMetadata(
                remediation_type=RemediationType.AUTO_FIX,
                fix_confidence=1.0,
                mode="SAFE",
                explainer_class=AwsDbUnencryptedExplainer,
                fixer_class=AwsDbUnencryptedFixer
            )
        }

    def get_remediation_in_memory(self, rule_id: str, file_path: str, resource_type: str, resource_name: str, original_content: str) -> Dict[str, Any]:
        """
        Orchestrates remediation calculation entirely in memory.
        Applies fixer to original_content, validates, generates unified diff,
        and returns detailed remediation metadata.
        """
        metadata = self._registry.get(rule_id)
        if not metadata:
            return {}

        explanation = metadata.explainer.explain()
        diff_str = None
        validation_status = "PENDING"

        try:
            # Execute dry-run fix in memory
            modified_content = metadata.fixer.apply_fix_content(original_content, resource_type, resource_name)
            
            # Generate unified patch
            diff_str = generate_unified_diff(original_content, modified_content, file_path)
            validation_status = "SUCCESS"
        except Exception as e:
            validation_status = f"FAILED: {str(e)}"

        return {
            "explanation": explanation,
            "remediation_type": metadata.remediation_type.value,
            "remediation_mode": metadata.mode,
            "fix_confidence": metadata.fix_confidence,
            "remediation_diff": diff_str,
            "validation_status": validation_status
        }

    def get_remediation(self, rule_id: str, file_path: str, resource_type: str, resource_name: str) -> Dict[str, Any]:
        """
        Loads the file from disk and delegates to get_remediation_in_memory.
        """
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                original_content = f.read()
            return self.get_remediation_in_memory(rule_id, file_path, resource_type, resource_name, original_content)
        except Exception as e:
            return {
                "validation_status": f"FAILED: {str(e)}"
            }

# Global registry instance
remediation_registry = RemediationRegistry()

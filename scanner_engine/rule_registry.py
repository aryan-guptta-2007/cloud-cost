from typing import List
from scanner_engine.rules.base_rule import BaseRule
from scanner_engine.rules.aws_s3_public_rule import AwsS3PublicRule
from scanner_engine.rules.aws_sg_open_rule import AwsSgOpenRule
from scanner_engine.rules.aws_iam_wildcard_rule import AwsIamWildcardRule
from scanner_engine.rules.aws_db_unencrypted_rule import AwsDbUnencryptedRule

class RuleRegistry:
    """
    Registry for loading and querying security scanning rules.
    """
    def __init__(self):
        # Register rule instances
        self._rules: List[BaseRule] = [
            AwsS3PublicRule(),
            AwsSgOpenRule(),
            AwsIamWildcardRule(),
            AwsDbUnencryptedRule(),
        ]

    def get_all_rules(self) -> List[BaseRule]:
        """Returns all registered security check instances."""
        return self._rules

# Global registry instance
registry = RuleRegistry()

import json
from typing import List
from scanner_engine.rules.base_rule import BaseRule
from shared.constants.severity import Severity
from shared.constants.category import Category
from shared.schemas.finding_schema import Finding

def strip_heredoc(s: str) -> str:
    """Strips arbitrary Terraform heredoc markers (e.g. <<EOF, <<-POLICY)."""
    s = s.strip()
    if s.startswith("<<"):
        first_line_end = s.find("\n")
        if first_line_end != -1:
            marker = s[2:first_line_end].strip("-").strip()
            body = s[first_line_end:].strip()
            if body.endswith(marker):
                return body[:-len(marker)].strip()
    return s

class AwsIamWildcardRule(BaseRule):
    """
    Scans IAM policies to detect wildcard permissions in Action or Resource with Allow effect.
    """
    def __init__(self):
        super().__init__(
            id="AWS_IAM_WILDCARD",
            severity=Severity.CRITICAL,
            title="IAM Wildcard Statement Allowed",
            description="An IAM policy allows unrestricted action (*) or resource access (*) with Allow effect, violating least privilege principles.",
            recommended_fix="Restrict Action list and Resource scopes to minimum required parameters.",
            category=Category.IAM_SECURITY
        )

    def check(self, parsed_data: dict, file_path: str) -> List[Finding]:
        findings = []
        resources = parsed_data.get("resource", {})
        
        # Scan common IAM policy resource types individually to preserve their resource_type
        for r_type in ["aws_iam_policy", "aws_iam_role_policy", "aws_iam_user_policy"]:
            policy_resources = resources.get(r_type, {})
            for name, config in policy_resources.items():
                if not isinstance(config, dict):
                    continue
                policy_str = config.get("policy")
                if not policy_str:
                    continue

                policy_data = None
                if isinstance(policy_str, dict):
                    policy_data = policy_str
                elif isinstance(policy_str, str):
                    cleaned_policy_str = strip_heredoc(policy_str)
                    try:
                        policy_data = json.loads(cleaned_policy_str)
                    except json.JSONDecodeError:
                        cleaned_policy = "".join(cleaned_policy_str.split())
                        if '"Effect":"Allow"' in cleaned_policy and ('"Action":"*"' in cleaned_policy or '"Resource":"*"' in cleaned_policy):
                            findings.append(
                                Finding(
                                    rule_id=self.id,
                                    file_path=file_path,
                                    severity=self.severity,
                                    title=self.title,
                                    description="IAM policy statement contains wildcard 'Action' or 'Resource' with 'Allow' effect.",
                                    recommended_fix=self.recommended_fix,
                                    resource_type=r_type,
                                    resource_name=name,
                                    code_snippet=cleaned_policy_str.strip()[:100] + "...",
                                    confidence=0.8
                                )
                            )
                        continue

                if policy_data and isinstance(policy_data, dict):
                    statements = policy_data.get("Statement")
                    if not statements:
                        continue
                    if not isinstance(statements, list):
                        statements = [statements]

                    for stmt in statements:
                        if not isinstance(stmt, dict):
                            continue
                        effect = stmt.get("Effect")
                        if effect != "Allow":
                            continue

                        action = stmt.get("Action")
                        resource = stmt.get("Resource")

                        has_action_wildcard = (action == "*") or (isinstance(action, list) and "*" in action)
                        has_resource_wildcard = (resource == "*") or (isinstance(resource, list) and "*" in resource)

                        if has_action_wildcard or has_resource_wildcard:
                            snippet = json.dumps(stmt)
                            findings.append(
                                Finding(
                                    rule_id=self.id,
                                    file_path=file_path,
                                    severity=self.severity,
                                    title=self.title,
                                    description=f"IAM statement allows unrestricted access. (Action Wildcard: {has_action_wildcard}, Resource Wildcard: {has_resource_wildcard})",
                                    recommended_fix=self.recommended_fix,
                                    resource_type=r_type,
                                    resource_name=name,
                                    code_snippet=snippet[:120],
                                    confidence=1.0
                                )
                            )
                            break

        return findings

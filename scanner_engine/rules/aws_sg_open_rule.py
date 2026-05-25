from typing import List
from scanner_engine.rules.base_rule import BaseRule
from shared.constants.severity import Severity
from shared.constants.category import Category
from shared.schemas.finding_schema import Finding

SENSITIVE_PORTS = {22, 3389, 5432, 3306, 27017}

def is_open_cidr(cidr_blocks) -> bool:
    if isinstance(cidr_blocks, list):
        return any(c in ["0.0.0.0/0", "::/0"] for c in cidr_blocks)
    return cidr_blocks in ["0.0.0.0/0", "::/0"]

def ports_overlap_sensitive(from_port, to_port) -> bool:
    try:
        from_p = int(from_port)
        to_p = int(to_port)
        if from_p == -1 or to_p == -1 or (from_p == 0 and to_p == 0):
            return True
        return any(from_p <= sp <= to_p for sp in SENSITIVE_PORTS)
    except (ValueError, TypeError):
        return False

class AwsSgOpenRule(BaseRule):
    """
    Checks if a security group ingress block allows public ingress (0.0.0.0/0 or ::/0) on sensitive ports.
    """
    def __init__(self):
        super().__init__(
            id="AWS_SG_OPEN",
            severity=Severity.HIGH,
            title="Unrestricted Sensitive Ingress Allowed",
            description="A security group ingress rule is wide open to the internet (0.0.0.0/0 or ::/0) for a sensitive port (SSH, RDP, or Database).",
            recommended_fix="Restrict cidr_blocks to specific IP ranges or secure Bastion hosts.",
            category=Category.NETWORK_SECURITY
        )

    def check(self, parsed_data: dict, file_path: str) -> List[Finding]:
        findings = []
        resources = parsed_data.get("resource", {})
        
        # 1. Inline ingress blocks within aws_security_group
        security_groups = resources.get("aws_security_group", {})
        for sg_name, sg_config in security_groups.items():
            if not isinstance(sg_config, dict):
                continue
            ingress = sg_config.get("ingress")
            if not ingress:
                continue
            
            ingress_list = ingress if isinstance(ingress, list) else [ingress]
            for ing in ingress_list:
                if not isinstance(ing, dict):
                    continue
                cidr_blocks = ing.get("cidr_blocks")
                from_port = ing.get("from_port")
                to_port = ing.get("to_port")
                
                if cidr_blocks and is_open_cidr(cidr_blocks) and ports_overlap_sensitive(from_port, to_port):
                    findings.append(
                        Finding(
                            rule_id=self.id,
                            file_path=file_path,
                            severity=self.severity,
                            title=self.title,
                            description=f"Security Group '{sg_name}' allows wide-open ingress on sensitive port(s) {from_port}-{to_port}.",
                            recommended_fix=self.recommended_fix,
                            code_snippet=f"cidr_blocks = {cidr_blocks}",
                            confidence=1.0
                        )
                    )

        # 2. Independent aws_security_group_rule resources
        sg_rules = resources.get("aws_security_group_rule", {})
        for rule_name, rule_config in sg_rules.items():
            if not isinstance(rule_config, dict):
                continue
            rule_type = rule_config.get("type")
            if rule_type != "ingress":
                continue
            
            cidr_blocks = rule_config.get("cidr_blocks")
            from_port = rule_config.get("from_port")
            to_port = rule_config.get("to_port")
            
            if cidr_blocks and is_open_cidr(cidr_blocks) and ports_overlap_sensitive(from_port, to_port):
                findings.append(
                    Finding(
                        rule_id=self.id,
                        file_path=file_path,
                        severity=self.severity,
                        title=self.title,
                        description=f"Security Group Rule '{rule_name}' allows wide-open ingress on sensitive port(s) {from_port}-{to_port}.",
                        recommended_fix=self.recommended_fix,
                        code_snippet=f"cidr_blocks = {cidr_blocks}",
                        confidence=1.0
                    )
                )

        return findings

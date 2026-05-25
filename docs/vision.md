# SentraAI Product Vision & Philosophy

SentraAI is built to address the biggest challenge in cloud security: the friction between security teams and developers. By embedding scanning and fixing directly into the existing developer workflow, SentraAI turns security from an obstacle into an automated helper.

## The Core Problem

Traditional cloud security tools act as gatekeepers or alert generators. They run scan audits, produce 100-page PDF reports, or dump thousands of alerts into a dashboard that developers rarely look at. Security teams are frustrated because risks aren't resolved; developers are frustrated because context-switching hurts velocity.

## SentraAI Solution

SentraAI integrates directly with the pull request (PR) process. It does not just alert developers that something is broken; it shows them **exactly why** it is dangerous and provides a **safe, copy-pasteable (or auto-commit) code remediation diff** directly inside the PR review page.

---

## Product Principles

Our design philosophy is centered entirely on **Developer Experience (DX)**:

1. **Invisible Workflow Integration**
   - The developer should never have to log into a new dashboard to see security findings. The tool lives entirely inside GitHub Pull Requests.
2. **Developer-First UX**
   - Explanations must be plain-English and concise, not jargon-heavy.
   - Code diffs must be valid, formatted, and ready to apply.
3. **Minimal Friction**
   - Scanning must be fast (completed within seconds of a push).
   - False positives must be actively minimized. A developer should never be blocked by a noise-alert.
4. **Explain Before Blocking**
   - Always teach the developer the security risk before blocking a merge. A well-explained risk turns a developer into a security ally.
5. **Automation Over Alerts**
   - Do not just say "fix your S3 bucket." Say "here is the exact code change to secure your S3 bucket." Give solutions, not problems.

---

## MVP Scope (v1)

To achieve maximum speed and product validation, our first version focuses on a single, bulletproof developer experience:

* **What it does**:
  1. Detects critical Terraform security issues (Public S3, Open Security Group, Wildcard IAM, Unencrypted DB).
  2. Explains the risks instantly using pattern-based templates.
  3. Generates a safe, ready-to-use Terraform code diff.
  4. Comments directly on the GitHub PR.
* **What it explicitly defers** (No Scope Creep):
  * **No Dashboard**: The PR comment is the user interface.
  * **No Kubernetes**: Focused strictly on Terraform/cloud infrastructure.
  * **No Multi-Cloud Complexities**: Initial rules focus on AWS security.
  * **No Paid LLM API dependencies**: Use rule and template matching for deterministic speed, safety, and zero operational burn.

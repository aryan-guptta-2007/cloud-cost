# SentraAI Implementation Roadmap

This roadmap defines the precise building order to achieve a validated MVP with zero feature creep and minimal operational cost.

---

## Phase 1: Scanner Rules Engine (Core Technology)
* **Goal**: Build a Python-based static parser for Terraform files that reliably flags critical misconfigurations.
* **Scope**: Build detection modules for:
  - **AWS_S3_PUBLIC**: Detecting `acl = "public-read"` or similar public access configurations.
  - **AWS_SG_OPEN**: Detecting Security Groups permitting unrestricted ingress (`cidr_blocks = ["0.0.0.0/0"]`) on sensitive ports.
  - **AWS_IAM_WILDCARD**: Detecting wildcard statements (`"Action": "*"` or `"Resource": "*"`) in IAM policies.
  - **AWS_DB_UNENCRYPTED**: Detecting databases configured with encryption disabled (`storage_encrypted = false`).
* **Deliverable**: A local CLI script that takes a directory of `.tf` files and outputs standard JSON finding reports matching the defined schema.
* **Timeline**: 1-2 days.

---

## Phase 2: Remediation & Explanation Engine
* **Goal**: Generate precise, plain-English reasons for why the detected rule failure is risky, alongside a standard unified git diff to resolve it.
* **Scope**:
  - Implement a mapping module translating Rule IDs (like `AWS_S3_PUBLIC`) to remediation explanations and templates.
  - Write template diff builders that replace the insecure lines with safe parameters.
* **Deliverable**: Local tests verifying that feeding a finding structure outputs the correct markdown comments and diff formats.
* **Timeline**: 1-2 days.

---

## Phase 3: GitHub App & FastAPI Webhooks (Product Integration)
* **Goal**: Connect the scanner and remediation engines to live Pull Request events.
* **Scope**:
  - Set up a FastAPI server with a `/webhook` endpoint.
  - Parse the GitHub `pull_request` event and pull down modified `.tf` files.
  - Execute the Scanner & Remediation engines on the incoming files.
  - Post the results as inline review comments on the exact line numbers where errors occurred.
* **Deliverable**: A fully functioning local webhook listener that comments on a test repository PR.
* **Timeline**: 2-3 days.

---

## Phase 4: Productionization & Deployment
* **Goal**: Prepare the monorepo for secure cloud hosting.
* **Scope**:
  - Create Dockerfiles for the FastAPI backend.
  - Set up environment variables and configuration files.
  - Deploy to an AWS EC2 instance or ECS cluster using basic Docker Compose.
* **Timeline**: 1-2 days.

---

## Deferred Features (Out of MVP Scope)

To stay laser-focused on the core PR-based experience, the following features are strictly deferred:

* **SaaS Dashboard / UI**: Defer building any frontend or database dashboard until the core webhook/PR-commenting workflow is proven and developers are actively engaging with it.
* **Kubernetes (K8s) Scanners**: Focus is strictly on Terraform config files.
* **Multi-Cloud scanners**: Focus is strictly on AWS infrastructure rules initially.
* **LLM Engine integration**: Focus is on rule-based performance. AI engine is deferred to phase 2 of the company life-cycle.

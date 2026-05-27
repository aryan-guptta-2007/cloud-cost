# SentraAI Monorepo

SentraAI is an automated cloud security scanning and remediation tool for Terraform. It detects cloud security vulnerabilities in Pull Requests, explains them clearly using pre-defined patterns, and generates automated, safe terraform diff fixes to comment directly back into GitHub PRs.

## Project Structure

This project uses a monorepo structure to facilitate rapid development, shared contracts, and simplified dependencies:

```
sentra-ai/
│
├── frontend/             # Next.js + TypeScript dashboard UI (deferred)
├── backend/              # FastAPI application server for processing Webhooks
├── scanner-engine/       # Core Python engine for parsing and analyzing Terraform configurations
│   ├── terraform/        # Terraform file parsers
│   ├── rules/            # Security rules (S3, Security Groups, IAM, Database)
│   ├── parsers/          # AST and pattern analysis tools
│   └── outputs/          # Scan reports generators
├── remediation-engine/   # Module for generating fixes and explanations
├── shared/               # Shared logic, data schemas, and API contracts
│   ├── schemas/          # Data schemas for rules and findings
│   ├── constants/        # Common security constraints and severity mappings
│   ├── contracts/        # API payloads and webhook contracts
│   └── types/            # Shared type interfaces
├── infrastructure/       # Dockerfiles, deployment, and docker-compose configurations
├── config/               # App configuration, security profiles, and environments
├── tests/                # Automated unit and integration tests
│   ├── scanner/          # Scanner test suites
│   ├── remediation/      # Remediation explanation test suites
│   └── backend/          # Webhook API and worker test suites
├── scripts/              # Setup, utility, and maintenance scripts
└── docs/                 # Product and technical design documentation
```

## Setup & Getting Started

Refer to the detailed product and architectural documentation inside the `docs/` folder:
- **Vision & Principles**: [docs/vision.md](docs/vision.md)
- **Technical Architecture**: [docs/architecture.md](docs/architecture.md)
- **Roadmap & Milestones**: [docs/roadmap.md](docs/roadmap.md)
- **Architectural Decision Log**: [docs/decision-log.md](docs/decision-log.md)

## Development Workflow

1. Configure Python virtual environments and Node dependencies inside their respective service directories.
2. Run local tests inside `tests/` using test runners.
3. Deploy local integration testbeds using `infrastructure/`.
Webhook test process
Webhook PR testing

# SentraAI Backend

This service runs the FastAPI backend for SentraAI. It listens to incoming webhooks from GitHub, coordinates scanning, and posts remediation comments back to the PRs.

## Folder Structure

* `app/`: FastAPI application code.
* `app/main.py`: Webhook ingress and endpoint declarations.
* `app/webhooks/`: Webhook payload parser and signature validators.
* `app/worker/`: Background worker logic.

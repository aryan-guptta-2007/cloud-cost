import logging
from fastapi import FastAPI
from backend.app.api.webhook import router as webhook_router

# Configure structured logging formatting for tracing metrics
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("sentra-ai")

app = FastAPI(
    title="SentraAI Webhook Receiver Backend",
    version="1.0.0",
    description="Automated static analysis scanning and remediation feedback webhook server."
)

# Register Webhook Router
app.include_router(webhook_router)

@app.get("/")
def read_root():
    """Simple API health check endpoint."""
    return {
        "status": "healthy",
        "app": "SentraAI Webhook Receiver Backend",
        "version": "1.0.0"
    }

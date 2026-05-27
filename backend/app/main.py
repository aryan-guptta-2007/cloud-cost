import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.webhook import router as webhook_router
from app.api.dashboard import router as dashboard_router
from app.database.db_client import run_migrations

# Configure structured logging formatting for tracing metrics
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("sentra-ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages application lifespan events.
    On startup: runs database migrations and retention cleanup.
    On shutdown: any cleanup can be added here.
    """
    try:
        run_migrations()
        logger.info("Database migrations executed successfully on startup.")
    except Exception as e:
        logger.critical(f"Database migrations failed on startup: {str(e)}")
    yield  # Application runs here


app = FastAPI(
    title="SentraAI Webhook Receiver Backend",
    version="1.0.0",
    description="Automated static analysis scanning and remediation feedback webhook server.",
    lifespan=lifespan
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for demo purposes
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(webhook_router)
app.include_router(dashboard_router)


@app.get("/")
def read_root():
    """Simple API health check endpoint."""
    return {
        "status": "healthy",
        "app": "SentraAI Webhook Receiver Backend",
        "version": "1.0.0"
    }

import hmac
import hashlib
from fastapi import Request, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from app.config import GITHUB_WEBHOOK_SECRET

signature_header = APIKeyHeader(name="X-Hub-Signature-256", auto_error=False)

async def verify_signature(request: Request, signature: str = Security(signature_header)):
    """
    Verifies that the incoming GitHub webhook payload signature matches the configured secret.
    Uses hmac.compare_digest to prevent timing attacks.
    """
    # If secret is omitted, skip validation (development mode)
    if not GITHUB_WEBHOOK_SECRET:
        return

    if not signature:
        raise HTTPException(status_code=401, detail="X-Hub-Signature-256 header is missing.")

    if not signature.startswith("sha256="):
        raise HTTPException(status_code=400, detail="Invalid signature format. Must begin with sha256=.")

    expected_hash = signature[7:]  # Remove the 'sha256=' prefix
    
    body = await request.body()
    
    mac = hmac.new(
        GITHUB_WEBHOOK_SECRET.encode("utf-8"),
        msg=body,
        digestmod=hashlib.sha256
    )
    actual_hash = mac.hexdigest()

    if not hmac.compare_digest(expected_hash, actual_hash):
        raise HTTPException(status_code=403, detail="Webhook signature mismatch. Access denied.")

from fastapi import APIRouter, Request, BackgroundTasks, Header, Depends, status
from backend.app.security.signature_validator import verify_signature
from backend.app.services.webhook_service import (
    process_pull_request_webhook,
    process_review_comment_webhook,
)

router = APIRouter()

@router.post("/webhook", status_code=status.HTTP_202_ACCEPTED)
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_github_event: str = Header(...),
    x_github_delivery: str = Header(...),
    _ = Depends(verify_signature)
):
    """
    Receives incoming GitHub webhook events.
    Verifies signature and dispatches pull request scans or comment triggers to background tasks.
    """
    payload = await request.json()

    if x_github_event == "pull_request":
        background_tasks.add_task(
            process_pull_request_webhook,
            x_github_delivery,
            payload
        )
        return {"message": "Webhook payload accepted. Processing scheduled."}
    
    elif x_github_event == "pull_request_review_comment":
        background_tasks.add_task(
            process_review_comment_webhook,
            x_github_delivery,
            payload
        )
        return {"message": "Webhook payload accepted. Processing scheduled."}
    
    return {"message": f"Ignoring unsupported event type: {x_github_event}"}


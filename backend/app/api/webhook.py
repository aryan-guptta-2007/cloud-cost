from fastapi import APIRouter, Request, BackgroundTasks, Header, Depends, status
from app.security.signature_validator import verify_signature
from app.services.webhook_service import (
    process_pull_request_webhook,
    process_review_comment_webhook,
)

router = APIRouter()

@router.post("/webhook", status_code=status.HTTP_202_ACCEPTED)
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_github_event: str = Header(None, alias="X-GitHub-Event"),
    x_github_delivery: str = Header(None, alias="X-GitHub-Delivery"),
    _ = Depends(verify_signature)
):
    """
    Receives incoming GitHub webhook events.
    Verifies signature and dispatches pull request scans or comment triggers to background tasks.
    Also logs event details for debugging.
    """
    event = x_github_event or request.headers.get("X-GitHub-Event")
    payload = await request.json()

    print("GitHub Event:", event)

    # Handle Pull Request
    if event == "pull_request":
        action = payload.get("action")
        pr_title = payload.get("pull_request", {}).get("title") if isinstance(payload.get("pull_request"), dict) else None
        repo_name = payload.get("repository", {}).get("full_name") if isinstance(payload.get("repository"), dict) else None

        print("PR Action:", action)
        print("PR Title:", pr_title)
        print("Repository:", repo_name)

        if x_github_delivery:
            background_tasks.add_task(
                process_pull_request_webhook,
                x_github_delivery,
                payload
            )
            return {"message": "Webhook payload accepted. Processing scheduled."}
        else:
            return {"message": "Pull Request webhook received"}
            
    # Handle Pull Request Review Comment (GitOps /approve)
    elif event == "pull_request_review_comment":
        if x_github_delivery:
            background_tasks.add_task(
                process_review_comment_webhook,
                x_github_delivery,
                payload
            )
            return {"message": "Webhook payload accepted. Processing scheduled."}
        else:
            return {"message": "Pull Request Review Comment webhook received"}

    # Handle Push
    elif event == "push":
        print("Push event received")
        return {"message": "Push webhook received"}

    return {"message": f"Ignoring unsupported event type: {event}"}


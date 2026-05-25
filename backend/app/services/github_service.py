import os
import sys
import time
import jwt
import httpx
import asyncio
import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

# Ensure parent directory is in path for imports
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from backend.app.config import get_private_key, GITHUB_APP_ID
from shared.constants.comment_signature import COMMENT_SIGNATURE

logger = logging.getLogger("sentra-ai")

class GitProvider(ABC):
    """Abstract interface defining the Git hosting provider operations."""
    @abstractmethod
    async def get_pr_files(self, repo_full_name: str, pr_number: int, sha: str) -> List[Dict[str, Any]]:
        """Returns metadata about files changed in a Pull Request."""
        pass
        
    @abstractmethod
    async def get_file_content(self, repo_full_name: str, path: str, sha: str) -> str:
        """Downloads the file contents as a string."""
        pass
        
    @abstractmethod
    async def post_or_update_pr_comment(self, repo_full_name: str, pr_number: int, comment_body: str) -> None:
        """Consolidates findings by posting or editing in-place PR review comments."""
        pass


class GitHubProvider(GitProvider):
    """GitHub specific API implementation using App authentication and token caching."""
    def __init__(self, installation_id: int):
        self.installation_id = installation_id
        self._token: Optional[str] = None
        self._token_expires_at: float = 0.0

    def _generate_jwt(self) -> str:
        private_key = get_private_key()
        if not private_key or not GITHUB_APP_ID:
            raise ValueError("Missing GITHUB_APP_ID or GITHUB_PRIVATE_KEY configurations.")
            
        payload = {
            "iat": int(time.time()) - 60,
            "exp": int(time.time()) + (10 * 60),  # Max 10 mins
            "iss": int(GITHUB_APP_ID)
        }
        return jwt.encode(payload, private_key, algorithm="RS256")

    async def _get_access_token(self) -> str:
        """Fetches installation token, caching it until expiration."""
        now = time.time()
        if self._token and now < self._token_expires_at - 60:
            return self._token

        jwt_token = self._generate_jwt()
        headers = {
            "Authorization": f"Bearer {jwt_token}",
            "Accept": "application/vnd.github.v3+json"
        }
        url = f"https://api.github.com/app/installations/{self.installation_id}/access_tokens"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            self._token = data["token"]
            
            # Format expires_at timestamp from GitHub response (e.g. '2026-05-25T15:20:00Z')
            # Fallback to standard 1 hour validity
            self._token_expires_at = now + 3600
            return self._token

    async def _request_with_retry(self, client: httpx.AsyncClient, method: str, url: str, **kwargs) -> httpx.Response:
        """Executes API requests, handling GitHub rate limiting (403/429) with backoff retries."""
        max_retries = 3
        backoff = 1.0
        for attempt in range(max_retries):
            try:
                response = await client.request(method, url, **kwargs)
                if response.status_code == 429 or (response.status_code == 403 and "rate limit" in response.text.lower()):
                    retry_after = float(response.headers.get("Retry-After", str(backoff)))
                    logger.warning(f"Rate limited by GitHub. Retrying in {retry_after}s... (Attempt {attempt+1}/{max_retries})")
                    await asyncio.sleep(retry_after)
                    backoff *= 2
                    continue
                response.raise_for_status()
                return response
            except httpx.HTTPStatusError as e:
                if attempt == max_retries - 1:
                    raise e
                logger.warning(f"GitHub API Error: {str(e)}. Retrying in {backoff}s...")
                await asyncio.sleep(backoff)
                backoff *= 2
        raise Exception(f"GitHub API request failed after {max_retries} attempts.")

    async def get_pr_files(self, repo_full_name: str, pr_number: int, sha: str) -> List[Dict[str, Any]]:
        token = await self._get_access_token()
        headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json"
        }
        url = f"https://api.github.com/repos/{repo_full_name}/pulls/{pr_number}/files"
        
        async with httpx.AsyncClient() as client:
            response = await self._request_with_retry(client, "GET", url, headers=headers)
            return response.json()

    async def get_file_content(self, repo_full_name: str, path: str, sha: str) -> str:
        token = await self._get_access_token()
        headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3.raw"  # Force raw text download
        }
        url = f"https://api.github.com/repos/{repo_full_name}/contents/{path}"
        params = {"ref": sha}
        
        async with httpx.AsyncClient() as client:
            response = await self._request_with_retry(client, "GET", url, headers=headers, params=params)
            return response.text

    async def post_or_update_pr_comment(self, repo_full_name: str, pr_number: int, comment_body: str) -> None:
        token = await self._get_access_token()
        headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        # 1. Search for previous comments by looking for the comment signature
        list_url = f"https://api.github.com/repos/{repo_full_name}/issues/{pr_number}/comments"
        async with httpx.AsyncClient() as client:
            response = await self._request_with_retry(client, "GET", list_url, headers=headers)
            comments = response.json()
            
            existing_comment_id = None
            for comment in comments:
                body = comment.get("body", "")
                if body.startswith(COMMENT_SIGNATURE):
                    existing_comment_id = comment["id"]
                    break

            # 2. Update existing comment or create a new one
            if existing_comment_id:
                logger.info(f"Updating existing comment ID: {existing_comment_id}")
                update_url = f"https://api.github.com/repos/{repo_full_name}/issues/comments/{existing_comment_id}"
                await self._request_with_retry(
                    client, "PATCH", update_url, headers=headers, json={"body": comment_body}
                )
            else:
                logger.info(f"Creating new PR comment on PR #{pr_number}")
                await self._request_with_retry(
                    client, "POST", list_url, headers=headers, json={"body": comment_body}
                )

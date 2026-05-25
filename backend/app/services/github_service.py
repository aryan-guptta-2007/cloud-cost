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

    @abstractmethod
    async def create_check_run(self, repo_full_name: str, sha: str) -> Optional[int]:
        """Creates a pending check run on a commit. Returns check run ID."""
        pass

    @abstractmethod
    async def update_check_run(self, repo_full_name: str, check_run_id: int, conclusion: str, summary: str) -> None:
        """Updates the status and output of an existing check run."""
        pass

    @abstractmethod
    async def get_default_branch(self, repo_full_name: str) -> str:
        """Returns the default branch name (e.g. 'main') for the repository."""
        pass

    @abstractmethod
    async def create_branch(self, repo_full_name: str, branch_name: str, base_sha: str) -> bool:
        """
        Creates a new branch off base_sha.
        Branch name convention: sentraai/fix/<rule-slug>-<scan_id_prefix>
        Returns True on success, False if branch already exists.
        """
        pass

    @abstractmethod
    async def commit_file(
        self,
        repo_full_name: str,
        branch_name: str,
        file_path: str,
        new_content: str,
        commit_message: str
    ) -> bool:
        """
        Commits a single file to an existing branch via the GitHub Contents API.
        Fetches the file's current blob SHA first (required by GitHub API).
        Returns True on success.
        """
        pass

    @abstractmethod
    async def create_pull_request(
        self,
        repo_full_name: str,
        title: str,
        body: str,
        head_branch: str,
        base_branch: str,
        labels: list
    ) -> Optional[str]:
        """
        Creates a pull request. Returns the PR URL on success, None on failure.
        Labels are applied after creation (GitHub requires a separate API call).
        """
        pass

    @abstractmethod
    async def find_open_pr_for_branch(self, repo_full_name: str, head_branch: str) -> Optional[int]:
        """
        Returns the PR number of an open pull request with head=head_branch,
        or None if no such PR exists. Used for duplicate PR protection.
        """
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
            
            # Default to 1 hour validity
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
            "Accept": "application/vnd.github.v3.raw"
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

    async def create_check_run(self, repo_full_name: str, sha: str) -> Optional[int]:
        try:
            token = await self._get_access_token()
            headers = {
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json"
            }
            url = f"https://api.github.com/repos/{repo_full_name}/check-runs"
            payload = {
                "name": "SentraAI Security Check",
                "head_sha": sha,
                "status": "in_progress",
                "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
            
            async with httpx.AsyncClient() as client:
                response = await self._request_with_retry(client, "POST", url, headers=headers, json=payload)
                return response.json().get("id")
        except Exception as e:
            logger.warning(f"Failed to create GitHub Check Run: {str(e)}. Proceeding without check runs.")
            return None

    async def update_check_run(self, repo_full_name: str, check_run_id: int, conclusion: str, summary: str) -> None:
        try:
            token = await self._get_access_token()
            headers = {
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json"
            }
            url = f"https://api.github.com/repos/{repo_full_name}/check-runs/{check_run_id}"
            payload = {
                "status": "completed",
                "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "conclusion": conclusion,
                "output": {
                    "title": "SentraAI Security Review Completed",
                    "summary": summary
                }
            }
            
            async with httpx.AsyncClient() as client:
                await self._request_with_retry(client, "PATCH", url, headers=headers, json=payload)
        except Exception as e:
            logger.warning(f"Failed to update GitHub Check Run ID {check_run_id}: {str(e)}")

    async def get_default_branch(self, repo_full_name: str) -> str:
        """Returns the repository's default branch name (usually 'main')."""
        try:
            token = await self._get_access_token()
            headers = {
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json"
            }
            url = f"https://api.github.com/repos/{repo_full_name}"
            async with httpx.AsyncClient() as client:
                response = await self._request_with_retry(client, "GET", url, headers=headers)
                return response.json().get("default_branch", "main")
        except Exception as e:
            logger.warning(f"Failed to get default branch for {repo_full_name}: {str(e)}. Defaulting to 'main'.")
            return "main"

    async def create_branch(self, repo_full_name: str, branch_name: str, base_sha: str) -> bool:
        """
        Creates sentraai/fix/<slug>-<scan_id_prefix> branch off base_sha.
        Returns True on success, False if branch already exists or creation fails.
        """
        try:
            token = await self._get_access_token()
            headers = {
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json"
            }
            url = f"https://api.github.com/repos/{repo_full_name}/git/refs"
            payload = {
                "ref": f"refs/heads/{branch_name}",
                "sha": base_sha
            }
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code == 422:
                    logger.info(f"Branch '{branch_name}' already exists in {repo_full_name}.")
                    return False
                response.raise_for_status()
                logger.info(f"Branch '{branch_name}' created successfully in {repo_full_name}.")
                return True
        except Exception as e:
            logger.error(f"Failed to create branch '{branch_name}' in {repo_full_name}: {str(e)}")
            return False

    async def commit_file(
        self,
        repo_full_name: str,
        branch_name: str,
        file_path: str,
        new_content: str,
        commit_message: str
    ) -> bool:
        """
        Commits a single file to an existing branch.
        Fetches the current blob SHA first (GitHub Contents API requirement).
        Content is base64-encoded before transmission.
        Returns True on success.
        """
        import base64
        try:
            token = await self._get_access_token()
            headers = {
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json"
            }
            contents_url = f"https://api.github.com/repos/{repo_full_name}/contents/{file_path}"
            params = {"ref": branch_name}

            # Fetch current blob SHA (required by GitHub to update an existing file)
            current_blob_sha = None
            async with httpx.AsyncClient() as client:
                get_resp = await client.get(contents_url, headers=headers, params=params)
                if get_resp.status_code == 200:
                    current_blob_sha = get_resp.json().get("sha")

                encoded_content = base64.b64encode(new_content.encode("utf-8")).decode("utf-8")
                payload = {
                    "message": commit_message,
                    "content": encoded_content,
                    "branch": branch_name
                }
                if current_blob_sha:
                    payload["sha"] = current_blob_sha

                put_resp = await self._request_with_retry(client, "PUT", contents_url, headers=headers, json=payload)
                logger.info(f"File '{file_path}' committed to branch '{branch_name}' in {repo_full_name}.")
                return True
        except Exception as e:
            logger.error(f"Failed to commit '{file_path}' to '{branch_name}' in {repo_full_name}: {str(e)}")
            return False

    async def create_pull_request(
        self,
        repo_full_name: str,
        title: str,
        body: str,
        head_branch: str,
        base_branch: str,
        labels: list
    ) -> Optional[str]:
        """
        Creates a pull request. Returns the PR URL on success, None on failure.
        Labels applied via a separate PATCH call after PR creation
        (GitHub does not accept labels in the initial PR creation payload).
        """
        try:
            token = await self._get_access_token()
            headers = {
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json"
            }
            pr_url = f"https://api.github.com/repos/{repo_full_name}/pulls"
            payload = {
                "title": title,
                "body": body,
                "head": head_branch,
                "base": base_branch
            }
            async with httpx.AsyncClient() as client:
                response = await self._request_with_retry(client, "POST", pr_url, headers=headers, json=payload)
                pr_data = response.json()
                pr_number = pr_data.get("number")
                html_url = pr_data.get("html_url")
                logger.info(f"Autofix PR #{pr_number} created: {html_url}")

                # Apply labels via Issues API (labels work on both issues and PRs)
                if labels and pr_number:
                    labels_url = f"https://api.github.com/repos/{repo_full_name}/issues/{pr_number}/labels"
                    try:
                        await self._request_with_retry(
                            client, "POST", labels_url, headers=headers, json={"labels": labels}
                        )
                        logger.info(f"Labels {labels} applied to PR #{pr_number}.")
                    except Exception as le:
                        logger.warning(f"Failed to apply labels to PR #{pr_number}: {str(le)}")

                return html_url
        except Exception as e:
            logger.error(f"Failed to create pull request in {repo_full_name}: {str(e)}")
            return None

    async def find_open_pr_for_branch(self, repo_full_name: str, head_branch: str) -> Optional[int]:
        """
        Returns the PR number of an existing open PR with head=head_branch.
        Used for duplicate PR protection before creating any autofix PR.
        Returns None if no such PR exists.
        """
        try:
            token = await self._get_access_token()
            headers = {
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json"
            }
            url = f"https://api.github.com/repos/{repo_full_name}/pulls"
            params = {"state": "open", "head": f"{repo_full_name.split('/')[0]}:{head_branch}"}
            async with httpx.AsyncClient() as client:
                response = await self._request_with_retry(client, "GET", url, headers=headers, params=params)
                prs = response.json()
                if prs:
                    return prs[0].get("number")
                return None
        except Exception as e:
            logger.warning(f"Failed to check for existing PR for branch '{head_branch}': {str(e)}")
            return None


# GitHub Actions Security Hardening

## Context

The repository has two GitHub Actions workflows. `summary.yml` contains command injection and prompt injection vulnerabilities — it interpolates user-controlled GitHub issue content directly into shell commands and AI prompts. The workflow is unused and should be deleted. `deploy.yml` needs access restrictions so only admins can trigger deployments.

## Changes

### 1. Delete `summary.yml`

Remove `.github/workflows/summary.yml` entirely. The workflow is not needed and contains two vulnerabilities:

- **Command injection (line 30):** `${{ steps.inference.outputs.response }}` interpolated directly into a `run:` shell command. An attacker can craft an issue that manipulates the AI response to include shell metacharacters, breaking out of single quotes and executing arbitrary commands with `GITHUB_TOKEN` permissions.
- **Prompt injection (lines 25-26):** `${{ github.event.issue.title }}` and `${{ github.event.issue.body }}` passed unsanitized into the AI prompt, allowing attackers to manipulate AI behavior.

### 2. Add GitHub Environment protection to `deploy.yml`

Add `environment: production` to the deploy job. This enables GitHub's built-in deployment protection rules:

- In GitHub repo Settings > Environments > "production", configure **required reviewers** — only approved users can approve deployments
- The `workflow_dispatch` manual trigger will require approval from a listed reviewer before the job runs
- Push-triggered deploys will also require approval, adding a safety gate

**Change:** Add one line to `deploy.yml`:

```yaml
jobs:
  deploy:
    name: Deploy to Production Server
    runs-on: self-hosted
    environment: production    # <-- add this line
```

After merging, configure the environment in GitHub Settings:
1. Go to repo Settings > Environments
2. Create "production" environment (if it doesn't already exist)
3. Add required reviewers (yourself / admins)
4. Optionally restrict to the `main` branch only

## Verification

1. Confirm `summary.yml` is deleted and no longer appears in Actions tab
2. Confirm `deploy.yml` has `environment: production`
3. After merging, configure the "production" environment in GitHub repo settings
4. Test: trigger a manual `workflow_dispatch` — it should require approval from a listed reviewer
5. Test: push to main — deploy should wait for environment approval

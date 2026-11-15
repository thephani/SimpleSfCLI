# Set up PR-Agent with OpenRouter

1. Create an API key in [OpenRouter](https://openrouter.ai/settings/keys).
2. In this GitHub repository, go to **Settings → Secrets and variables → Actions → New repository secret**.
3. Enter `OPENROUTER_API_KEY` as the name, paste the key as the secret, and select **Add secret**.
4. Merge the workflow and `.pr_agent.toml` into the default branch. GitHub supplies
   `GITHUB_TOKEN` automatically. The workflow also accepts an existing
   `OPENROUTER_KEY` secret. No OpenAI key is needed for the configured models.

The action sends PR diffs and relevant context to OpenRouter and the selected
model provider. The primary model is Qwen3.8 Flash, with DeepSeek V4.1 Flash
as the fallback. Both models are billed by OpenRouter.

The workflow explicitly sets `CONFIG__MODEL`, `CONFIG__FALLBACK_MODELS`, and
`CONFIG__CUSTOM_MODEL_MAX_TOKENS`. Keep these values in sync with `.pr_agent.toml`.
PR-Agent reads repository settings from the default branch, so the initial setup
PR cannot rely on its new `.pr_agent.toml` until that file is merged. Without the
workflow model settings, that run selects the upstream OpenAI default and asks
for `OPENAI_API_KEY` even when an OpenRouter key is provided.

## Automatic runs

PR-Agent runs `/describe` and `/review` when a PR is opened, reopened, marked
ready for review, or updated with new commits. It updates the PR description
and labels, preserves the author's description and title, and posts a review
with inline findings where PR-Agent can attach them to the diff.

The job skips bot events and comments on regular issues. GitHub normally
withholds repository secrets and write permissions from automatic
`pull_request` runs for fork PRs. PR conversation comments are a separate
trigger that runs from the default branch.

## Comment commands

Post one command in a new comment on the PR's **Conversation** tab.

| Command | What it does |
| --- | --- |
| `/review` | Run a review on demand. |
| `/describe` | Refresh the PR description and labels. |
| `/improve` | Request code suggestions. Applying one is a separate GitHub action for the reviewer. |
| `/ask What happens if deployment polling times out?` | Ask a question about the PR. |
| `/config` | Show the effective PR-Agent configuration. |
| `/test` | Unavailable in this open-source action. Use `/ask What Jest tests should cover this change?` for test ideas. |

The current PR-Agent action uses `inline_key_issues` for inline review
findings and does not implement the legacy `ask_and_reflect` setting.

To check the setup, open a same-repository PR and look for the **PR-Agent**
run in **Actions**. Confirm it updates the description and posts a review.
Then comment `/config` or `/ask What changed?` to verify the comment trigger.

See the upstream [GitHub setup guide](https://docs.pr-agent.ai/installation/github/)
and [command registry](https://github.com/the-pr-agent/pr-agent/blob/main/pr_agent/agent/pr_agent.py)
for current capabilities.

### Opening a PR

Invoked at the end of code-change playbooks when a PR is in scope.

Work from a git worktree off trunk, and keep unrelated work out of it. Give each concurrent `pstack_spawn` writer its own worktree and an explicit path. Rebase into small, landable commits. Run `/unslop` over the diff before commit and `/no-comments` before review.

Title: `type(scope): subject`, naming a real symbol when one carries the change. Body: a one-minute briefing under 40 lines with these `##` headings in order, dropping empty ones: `## Why`, `## What changed`, `## Scope`, `## Tradeoffs` (only rejected alternatives a reviewer would otherwise ask about), `## Blast Radius`, `## Verification`.

Stack follow-ups by base branch. Open PRs ready, through the run's PR tool with `draft: false`. Without one, use `gh pr create` without `--draft`. Opening a PR does not start a babysit.

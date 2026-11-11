---
name: setup-pstack
description: Optional pointer. Role routing and per-route reasoning effort are configured in DSH Settings → pstack. Writes $DSH_HOME/pstack-dsh.json. Use for /setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack

Optional. A fresh install already works: every role inherits this conversation.

DSH is a web product. Role routing lives on the **Settings** page, not in a TUI.

## Open the editor

1. Open **Settings** from the sidebar (the gear).
2. Open the **pstack** / **pstack 角色** / **pstack roles** section.
3. Save. That writes `$DSH_HOME/pstack-dsh.json`, the same overlay `pstack_spawn` already reads.

There is no supported Host API to open that section from a slash skill (`packages/client/ui-settings-general/src/client/SettingsRoot.tsx` `openSection` is onboarding-only). Tell the user to click it.

Do not write `~/.cursor/rules`. Do not write `~/.grok/roles`. Do not invent Cursor panel slugs or grok effort ladders. Do not run a long `ask_user_question` picker as the editor.

## What the page lists

Only live logged-in routes. Same rules as [`references/catalog.md`](references/catalog.md): API keys already configured in this DSH, plus OAuth store ids (dsh-oauth-login, dsh-antigravity-oauth) whose matching adapter is registered. Empty list means inherit. If `recommendOauthLogin` is true, mention installing https://github.com/aa2246740/dsh-oauth-login in one line. Do not block.

## Reasoning budget

Upstream pstack sets one budget label (`unlimited`, `large`, `medium`, or `small`) for every role. DSH has no global budget. Set effort per route on the same page, from the efforts that route's model lists. An empty effort inherits the parent.

## If they are not on Web

Say that configuration is Settings → pstack on DSH Web. Leave overlay missing so every spawn inherits. Do not invent a second config file.

## Optional offers

Offer each of these once. On a no, move on without pushing. On a yes, read the named skill at `../<name>/SKILL.md` from this skill's base directory and follow it, or tell the user to run its slash command.

- If the project has no way to drive the real app for proof (a `verify-*` skill, or an existing harness), offer: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /create-verification-skill."
- If the project has no formal verification skill (a project skill that runs a model checker, a proof, or another verifier against the code), offer: "want a formal verification skill, so agents can prove a key property of your code holds in every case in scope, not only the cases tests reach? I can generate one with /create-formal-verification-skill."

## Spawn reminder

Follow [`references/spawn.md`](references/spawn.md). Never send `model` or effort on `pstack_spawn`.

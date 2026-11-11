# DSH harness map

This port carries pstack 0.15's 23 playbooks and 24 principles, with DSH call sites. Invocation flags match upstream: only `setup-pstack` is model-invocable, and poteto-mode reads every other skill by path. See [UPGRADE-0.15.md](./UPGRADE-0.15.md) for the pinned upstream source and excluded runtime changes.

Sources: official pstack (`cursor/plugins` `pstack/`) and official DeepSeek Harness (`deepseek-ai/deepseek-harness`). Tool names and fields below are from DSH source, not from Cursor `Task` and not from grok-build `task`.

Sister port [pstack-grokbuild](https://github.com/aa2246740/pstack-grokbuild) is process lessons only. Do not copy its call sites.


## Verdict

**Yes. The discipline ports. Cursor and Grok runtimes do not.**

Install this repo as a DSH plugin on official DeepSeek Harness **0.2.2-rc.1** (`@deepseek-ai/dsh@0.2.2-rc.1`). `@deepseek-ai/dsh-*` peers are `>=0.2.2-rc.1 <0.2.3`. Do not write `~/.cursor/rules`. Do not invent Cursor panel slugs. Do not send grok `task` fields. Out of the box, children inherit this conversation's route. Configure roles in **Settings → pstack**. `/setup-pstack` is an optional pointer.

Official model-facing `subagent` cannot take a pstack role. This plugin registers `pstack_spawn`, which calls `ctx.subagents.startActivation` on the shipped `spawn` provider. Overlay provider, model, and reasoning effort go on the child `agentOptions` before the first request. Role limits use agent presets, not a prompt-only claim.

## Mapping: pstack need → DSH API

| pstack need | DSH API | Source |
|---|---|---|
| Slash skill / poteto-mode | `ctx.skills` provider + `dsh-tool-skill` `skill` tool. User `/name` injection. Frontmatter: kebab-case `name`, `description`, optional `whenToUse`, `disable-model-invocation`, `user-invocable`. `name: Poteto Mode` is invalid; this port uses `poteto-mode`. Flags match upstream: every pstack skill except `setup-pstack` sets `disable-model-invocation: true`. Those skills are user `/name` commands only. The `skill` tool refuses them, and the model-facing catalog hides them. | `packages/skill/tool-skill/README.md`; `docs/subsystems/skills.md`; `packages/skill/skill-filesystem/README.md`; `packages/skill/skill/src/index.ts` `SKILL_NAME` `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`; `packages/skill/tool-skill/src/index.ts` `isModelInvocable` |
| Leaf skills from poteto-mode (principles, `how`, `why`, `unslop`, …) | `read` tool on `../<name>/SKILL.md`, resolved against the `Base directory for this skill:` line that DSH prints in `<skill_resources>` when `/poteto-mode` loads. Not the `skill` tool. A file read works whatever the skill's invocation flags are. | `packages/skill/skill/src/index.ts` `renderSkillContent`; `packages/skill/skill-filesystem/src/index.ts` `resourceBase`; `packages/fs/tool-fs/src/read.ts` |
| Plugin install | npm bundle `dsh.bundle.patch` → `dsh plugin --profile web add github:ukewea/pstack-dsh` (pnpm, then restart Host and reload) | `docs/user/develop/basic/publish.md` |
| Settings GUI | Official **`settings.section`** list slot. This plugin registers id `pstack`, order 16, nav from `ctx.locale` (zh/en). Browser `dsh.client` + Host `GET`/`PUT` `/plugins/pstack-dsh/settings` on `ctx.webServer`. Overlay file unchanged. **Hypothesis:** slash skills cannot call `openSection`; that method is onboarding-only on `SettingsRoot`. | `packages/client/ui-settings/src/client/contract/slots.ts` `settings.section`; `packages/client/ui-settings-models/src/client/index.ts`; `packages/client/ui-settings-plugins/src/client/index.ts`; `packages/client/ui-settings-general/src/client/SettingsRoot.tsx` `openSection`; `packages/host/webserver/src/index.ts` `webServer.register`; dsh-oauth-login `src/client/index.tsx` |
| Spawn child | Model-facing official tool **`subagent`**: `description`, `prompt`, optional `cwd`. This plugin's **`pstack_spawn`**: those plus `role`, optional `route_index`, and optional `run_in_background`. Internally `ctx.subagents.startActivation` with `delivery: parent` unless `run_in_background` is false. | `packages/subagent/tool-subagent/src/index.ts` on DSH 0.2.2-rc.1 |
| Per-child model | `AgentOptions` `{ provider?, model?, maxTokens? }` on `SubagentStartRequest.agentOptions`. Not a model-facing `subagent` field. "Another model requires another named tool instance" unless a plugin sets `agentOptions` at start. Overlay maps a logged-in route onto that object. Omit it to inherit the parent. | `packages/core/agent/src/runtime-types.ts` `AgentOptions`; `packages/subagent/subagent/src/types.ts` `SubagentStartRequest.agentOptions`; `packages/subagent/tool-subagent/README.md` Config `agentOptions` |
| Per-role reasoning effort | **Not on `subagent`.** Overlay effort is `AgentOptions.reasoningEffort` on the child start request, checked against `resolveModelInfo().reasoning.efforts` before start. Empty or omitted effort inherits the parent. Never copy grok `xhigh/high/medium/low` or Cursor `max` unless that exact id is on **this** route. Do not change provider, model, or effort from `agent/request`. | `packages/core/agent/src/runtime-types.ts` `AgentOptions.reasoningEffort`; `packages/subagent/subagent/src/types.ts` `SubagentStartRequest.agentOptions`; `packages/core/agent-loop/src/agent.ts` rejects `agent/request` route changes |
| Wait | `run_in_background` omitted or true: one parent settlement notice. `false`: this call returns the result and does not also notify the parent. No `job_output`. | `ctx.subagents.startActivation` `delivery` |
| Cancel | `interrupt_agent` stops the current turn. No `job_kill`. | `docs/tool-catalog.md` `#deepseek-aidsh-tool-subagent-control` |
| Isolation / worktree / Cursor cloud | **No field** on `subagent`. Spawn-in-process inherits parent cwd. Drop `environment: "cloud"`. Parent may `git worktree add` and put the path in the prompt. | `packages/subagent/subagent-spawn-in-process/README.md` |
| Chat visuals (`/ketchup`) | DSH Web renders inline images from `![alt](</absolute/path>)`: screenshots, GIF, PNG and SVG. `/api/file` serves SVG as `image/svg+xml` under `sandbox; default-src 'none'`, so presentation attributes render and `<style>`, scripts and external resources do not (checked live on 0.2.2-rc.1). ketchup writes diagrams to `/tmp/pstack-ketchup/`, which the workspace-write sandbox allows. No Mermaid rendering, no inline video, no raw HTML; HTML files open in the preview sidebar from a link or `present`. | `packages/client/ui-chat` `localPathMediaUrl`; `packages/util/workspace-path` `fileMediaUrl`; `packages/client/ui-sidebar-documentpreview` |
| Current session history (`/ketchup`) | Skill content, goal rounds, runtime context, file-change and subagent notices arrive as user-role messages; only typed text is the user's. After compaction the earlier span is a `<compacted-summary>`. `session_event_search` / `session_event_read` exist only when the session-search bundle is enabled. | `packages/compaction/compaction-basic`; `packages/experimental/session-search` |
| Nested spawn | `maxDepth` is a runtime setting (Plugins → Subagent); DSH 0.2.2-rc.1 defaults it to **1**, so a child cannot spawn its own children unless the user raises it. Playbooks that used nested Cursor Task + worktree still prefer parent-owned fan-out so isolation stays in the prompt. | `packages/subagent/tool-subagent/src/index.ts` `maxDepth` default `3` |
| Todo | `todo_write({ todos: [{ content, status }] })` wholesale replace. Status: `pending` \| `in_progress` \| `completed`. **No** `id`, `merge`, `cancelled`. | `packages/todo/tool-todo/README.md` |
| Ask human | `ask_user_question` | `packages/interaction/tool-ask-user/README.md` |
| Overnight /loop | **No** grok `scheduler_create`. Closest shipped tools: `create_goal` / `update_goal` (`dsh-tool-goal`). If those tools are absent, keep iterating in this chat; do not invent a scheduler. | `docs/tool-catalog.md` `#deepseek-aidsh-tool-goal` |
| Credentials (presence only) | `ctx.credentials.describe(ref)` → `{ configured }` never the value | `packages/credentials/credentials/README.md` |
| DSH home | `$DSH_HOME`, else `~/.dsh` | `packages/util/home-paths/README.md` |
| DeepSeek default key ref | `DEEPSEEK_API_KEY` on provider `deepseek-official` | `packages/llm/llm-deepseek/src/index.ts` `DEFAULT_API_KEY_ENV`, `PROVIDER` |
| OAuth store (peer, not required) | `$DSH_HOME/.dsh-oauth-auth.json` (legacy `.pi-login-auth.json`). Map store ids → `pi-*` routes from [dsh-oauth-login](https://github.com/aa2246740/dsh-oauth-login). Do not read `~/.pi`, `~/.codex`, `~/.claude`, grok CLI login. | dsh-oauth-login `src/ids.ts`, `src/catalog.ts` |
| Independent verify | Parent `pstack_spawn` `role: independent-verifier`. Second opinion is a different logged-in route when overlay mapped one; otherwise inherit. The verifier does not write the diff. | this file |
| `cursor-team-kit` (`deslop`, `control-ui`, `control-cli`) | Not shipped. `/unslop` and `/no-comments` remain. Drive the real app (browser, CLI, tests). | official pstack README "not shipped here" |
| Benny automations | Cursor automation pack. Left under `automations/` as source, not a DSH runtime. | pstack `automations/` |
| Graphite `gt` | Optional if `gt` is on PATH. Otherwise `gh` + git. | playbooks |

## Official `subagent` fields the model may send

Installed `@deepseek-ai/dsh-tool-subagent` 0.2.2-rc.1, the package that corresponds to commit `66491b05e3f05ad35bcdd4f6cd7ed26041d9e3db` in this environment:

- `description` (string, required)
- `prompt` (string, required)
- `cwd` (string, optional)

There is no `run_in_background`. The tool always returns `{ kind: 'activation', subagentId }` and starts with `delivery: parent`. Do not send `run_in_background` on this fallback. A booted tool may also list `agent_preset`, or `provider` / `model` / `reasoning_effort` when model selection is enabled; do not invent those when they are absent. This fallback inherits the parent and cannot apply the pstack overlay.

`pstack_spawn` is the call that still accepts `run_in_background`. Omitted or true returns the child id and the runtime notifies the parent once. `false` waits in the tool and does not also notify the parent.

## Default spawn shape

Parent session only:

```text
pstack_spawn
  description: <3-5 words>
  prompt: <full brief, file pointers not inlined dumps>
  role: <pstack role key, e.g. feature | how-explainer | independent-verifier | poteto-agent | comment-sicko>
  run_in_background: true
  route_index: <only for panel roles when overlay has more than one route; default 0>
```

Do not send model or effort on that call. Route and effort come from `$DSH_HOME/pstack-dsh.json` when that role is mapped to a live logged-in route; otherwise the child inherits this conversation.

If `pstack_spawn` is missing, fall back to official `subagent` with `description`, `prompt`, and optional `cwd`. Do not send `run_in_background` on that tool. That path inherits the parent and cannot apply the overlay.

Then wait for the one parent settlement notice. `run_in_background: false` returns the result here instead, with no second notice. Cancel with `interrupt_agent`. Do not use `job_output` or `job_kill`.

Code-writing delegates: the playbook role key (`feature`, `bug-fix`, …). Ad-hoc helpers with no role key: `poteto-agent`. `/no-comments`: `comment-sicko`. Independent verify: `independent-verifier`.

## Effort home

**Store:** `$DSH_HOME/pstack-dsh.json` `roles.<key>.routes[].reasoningEffort`, only when `resolveModelInfo(provider, model).reasoning.efforts` lists that id.

**Apply:** `pstack_spawn` puts that provider, model, and effort on `SubagentStartRequest.agentOptions` before `startActivation`. The child Agent is created with those options, so the first model request already carries them. `agent/request` must not change the route or effort. A missing overlay inherits the parent. An unlisted route or effort fails the spawn and does not switch to another route.

## What Settings → pstack / `/setup-pstack` may list

The Settings page is the editor. It reads and writes `$DSH_HOME/pstack-dsh.json` through the same `buildCatalog` / overlay modules spawn uses. `/setup-pstack` only tells the user to open that page.

Only:

1. Registered `ctx.llm` adapters whose API key `credentials.describe(ref).configured` is true (settings `apiKeyEnv` walk, plus `DEEPSEEK_API_KEY` for `deepseek-official`).
2. Routes already in the dsh-oauth-login store **and** registered as `pi-*` adapters.

Empty catalog: inherit parent. Tell the user to add a key or install/login [dsh-oauth-login](https://github.com/aa2246740/dsh-oauth-login). Do not block. Do not show a vendor catalog.

## What this port dropped

| Cursor / Grok field | Why dropped |
|---|---|
| `Task.model` / Cursor panel slugs | Not on DSH `subagent`. Never invent slugs. |
| `Task.subagent_type` | DSH has no such field. Role is `pstack_spawn.role`. |
| `Task.isolation` / `environment: "cloud"` | No isolation field. Parent worktree + path in prompt. |
| grok `task.reasoning_effort` | Not on grok `task` either; also not on DSH `subagent`. |
| grok `~/.grok/roles` | DSH does not use that tree. Overlay is `$DSH_HOME/pstack-dsh.json`. |
| Cursor `~/.cursor/rules/pstack-models.mdc` | Cursor-only. |
| grok `scheduler_create` / Cursor `/loop` | Not in DSH. Use `create_goal` when present. |
| grok `get_task_output` | One parent settlement notice, or the foreground tool result. Not `job_output`. |
| Cursor `AskQuestion` / `TodoWrite` | DSH `ask_user_question` / `todo_write`. |

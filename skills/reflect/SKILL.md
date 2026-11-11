---
name: reflect
description: Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill. Use when the user says reflect.
disable-model-invocation: true
---

# Reflect

Mine the current conversation for durable learnings, then route them into skill edits.

Invoke when the user says "reflect" or "/reflect". Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## 1. Locate the active transcript

Before fanning out, find this conversation's DSH session log. JSONL backends expose a path through `SessionPersistence.locate`; SQLite backends share one database and have no per-session file (`docs/subsystems/persistence.md`). Use the current session and, if present, session-query tools. Do not glob `~/.cursor/projects/*/` or other workspaces' sessions. That crosses workspace boundaries and reads private chats from unrelated projects. Do not glob other users' `$DSH_HOME`.

If no on-disk transcript path resolves, pass a tight digest of this session instead.

## 2. Spawn three reviewers in parallel

One message, three `pstack_spawn` calls. Roles: `reflect-judgment`, `reflect-tooling`, `reflect-judgment` again for the divergent lens (`route_index` 0 unless overlay listed extra routes). `run_in_background: true`. Do not send `model`, effort, or `readonly`. The overlay route for each role sets model and effort, or the child inherits this conversation. If `pstack_spawn` refuses a mapped route, it does not substitute another one. Say so, and run that lens through the official `subagent` tool without `run_in_background`, which inherits this conversation. Reviewers need the same tools as the parent to look up the tickets, chat threads, and observability traces the transcript references. The prompt forbids file writes. The parent applies edits. Follow [`../setup-pstack/references/spawn.md`](../setup-pstack/references/spawn.md).

| Lens | `role` | Prompt template |
|---|---|---|
| Judgment | `reflect-judgment` | `references/judgment-reviewer.md` |
| Tooling | `reflect-tooling` | `references/tooling-reviewer.md` |
| Divergent | `reflect-judgment` | `references/divergent-reviewer.md` |

Pass each template verbatim, substituting the transcript path or digest where marked. Reviewers return findings in the spawn result or settlement notice.

## 3. Synthesize

One `pstack_spawn`, `role: reflect-judgment`. Do not send `model`, effort, or `readonly`. Overlay or inherit. It spot-verifies citations, so it needs the same tools as the parent. Pass `references/synthesizer.md` verbatim, with each reviewer's full output inlined where marked. It returns an Accepted / Rejected / Backlog list.

## 4. Structural enforcement check

Move any Accepted item that a lint rule, script, metadata flag, or runtime check would enforce more reliably to Backlog. See the **encode-lessons-in-structure** principle skill.

## 5. Apply

Present the synthesizer's full Accepted / Rejected / Backlog output and wait for explicit approval before applying any Accepted edit. The user picks the subset and may redirect routings. Skill changes affect future agents that load them. Do not auto-apply.

File each Backlog item to your team's devex or backlog tracker without waiting. Only the Accepted list waits for approval.

Never edit a skill inside an installed plugin package under `$DSH_HOME/profiles/`. Before approval, show its destination, `.dsh/skills/<skill>/` or `$DSH_HOME/skills/<skill>/`. After approval, copy the skill folder there and edit the copy. A skill with the same name in either directory takes precedence over the bundled one. Never open a PR or push.

Follow each approved row's Routing exactly:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): the parent does it directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): hand to the **authoring-a-skill** playbook skill and run its draft / test / iterate loop.
- `tune description: <skill path>` (the skill exists but didn't trigger when it should have): tighten `description` and kebab-case `name` per DSH skill-filesystem rules.
- `new skill via authoring-a-skill: <kebab-name>`: hand creation to the **authoring-a-skill** playbook. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done.

## 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog filed to the devex tracker: `<issue title>` (`<tags>`). One line each.
- Dropped: one line per rejected finding + reason from the synthesizer.

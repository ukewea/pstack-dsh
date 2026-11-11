# pstack_spawn

Canonical DSH spawn for this port. Playbooks follow this file. Do not send Cursor `Task` fields or grok `task` fields.

## Call

```text
pstack_spawn
  description: <3-5 words>
  prompt: <complete brief>
  role: <pstack role key>
  run_in_background: true
  route_index: <optional, panel roles only>
```

Allowed fields: `description`, `prompt`, `role`, `cwd`, `run_in_background`, `route_index`.

`run_in_background` defaults to true. True returns the child id immediately. The runtime notifies the parent once when the child finishes. False waits for the result in this call and does not also notify the parent. `cwd` is only the child's starting directory. It is not a sandbox. Parallel writers need separate directories.

Forbidden on this call: `model`, `provider`, `reasoning_effort`, `thinking`, `isolation`, `subagent_type`, `environment`, `readonly`, `resume_from`.

Route and effort come from `$DSH_HOME/pstack-dsh.json` when Settings → pstack mapped that role to a live logged-in route. Missing overlay, `inherit: true`, or empty `routes`: inherit this conversation. Usable without setup.

## Fallback

If `pstack_spawn` is not registered, call official `subagent` with `description`, `prompt`, and optional `cwd`. That schema has no `run_in_background`. The call returns a child id and the runtime notifies the parent once. You lose per-role overlay.

## Wait and cancel

`run_in_background` true or omitted returns the child id. The runtime notifies the parent once when the child finishes. `run_in_background` false waits in this call and does not also notify the parent. There is no job. Do not collect with `job_output` or stop with `job_kill`.

Do not poll `list_agents` for completion. A later turn for that same child uses official `send_message` when the child is still continuable. `interrupt_agent` stops the current turn.

## Isolation

`cwd` is only the child's starting directory. It is not a sandbox or a private worktree. Parallel writers need separate directories. The parent creates those directories and passes one path per child.

## Roles

| Role key | Used by |
|---|---|
| `feature` `refactoring` `bug-fix` `perf-issue` `hillclimb` | playbook code delegates |
| `judgment-and-prose` `hardest-tasks` | hardest / judgment code |
| `how-explorer` `how-explainer` | `/how` |
| `why-investigators` `why-synthesizer` | `/why` |
| `reflect-tooling` `reflect-judgment` | `/reflect` |
| `swarm-workers` | `/swarm` |
| `arena-runners` `arena-cross-judge-pool` | `/arena` |
| `architect-runners` | `/architect` via arena |
| `interrogate-reviewers` | `/interrogate` |
| `independent-verifier` | second opinion; does not write the diff |
| `poteto-agent` | ad-hoc playbook helpers |
| `comment-sicko` | `/no-comments` |

`generalPurpose` and `Comment Sicko` normalize to `poteto-agent` and `comment-sicko`.

Panel roles (`arena-runners`, `arena-cross-judge-pool`, `architect-runners`, `interrogate-reviewers`): call `pstack_overlay_read`. If the role inherits, spawn N independent children all inheriting (same route, separate reads). If the role has routes, one `pstack_spawn` per route with `route_index` 0..n-1. Do not invent slugs to fake a panel.

## Todo and questions

- `todo_write({ todos: [{ content, status }] })` replaces the whole list. Status is `pending`, `in_progress`, or `completed`. No `id`, `merge`, or `cancelled`.
- Product or preference questions: `ask_user_question`. Not Cursor `AskQuestion`.

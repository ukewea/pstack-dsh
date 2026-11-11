---
name: arena
description: "Spawn N parallel candidates at the same task, pick a base, graft the strongest parts of the losers into it. Use for /arena, 'arena this', 'throw it in the arena', or when one attempt at a non-trivial artifact would lock in the wrong shape."
disable-model-invocation: true
---

# Arena

Open a todolist with one entry per phase (Frame, Fan out, Cross-judge, Pick, Graft, Verify) before launching anything.

## Phase A: Frame

Every candidate gets the same prompt, so the prompt is the contract.

1. State the artifact each candidate is producing.
2. Derive the rubric, 3-6 concrete gradeable criteria for what success looks like on *this* task. It is the picker's tool in Phase D. Candidates only see the task.
3. Pick the runners. Call `pstack_overlay_read` and read the `arena-runners` role. If it lists routes, run one runner per route with `route_index` 0..n-1. If the role is missing, has `inherit: true`, or has no routes, spawn independent runners that all inherit this conversation, at least two. Do not invent provider or model ids. If `pstack_spawn` refuses a route because it is no longer a selectable live route, run that seat on another listed route of the same model family and say so, or drop the seat and say so when there is none. Phase C defines families. If dropped seats leave fewer than two runners, add runners until there are two, or one when the role lists one route. Run each added runner on a remaining runner's route. When no route remains, run it through the official `subagent` tool without `run_in_background`, which inherits this conversation, and say so. Spawn more runners when the arena covers multiple design directions. Use the same route N times when the work is generation-bound rather than judgment-sensitive. Reasoning effort comes from the overlay route. Do not send it.
4. Give each candidate its own output location (a git worktree where possible, otherwise `/tmp/arena-<slug>/candidate-<n>/`), per the **separate-before-serializing-shared-state** principle skill.

## Phase B: Fan out

Spawn all N subagents in one message with `pstack_spawn`, `role: arena-runners`, `run_in_background: true`, and `route_index` matching the overlay list when present. Do not send `model`. Follow [`../setup-pstack/references/spawn.md`](../setup-pstack/references/spawn.md). Each gets the task, the path to the shared grounding, its own output path, and instructions to produce the artifact and a short rationale naming the alternatives it considered and what it rejected. The candidate's output directory is the only completion channel: write the required artifact first, then the rationale. Do not invoke `/poteto-mode` from a candidate; it is a parent/session mode and is intentionally not model-invocable in DSH. Treat `send_message` as optional and never wait for it before writing the files.

The candidate prompt must state the exact required filenames and output directory. Candidates should create the directory if needed. A final prose response or settlement message is supplemental and is not evidence of completion.

If a candidate produces no output, proceed with N-1 and note the dropout. Before classifying a dropout, inspect the assigned directory after settlement and distinguish a missing artifact from a missing message or missing usage telemetry.

## Phase C: Cross-judge

After all Phase B candidates complete, call `pstack_overlay_read` and read the `arena-cross-judge-pool` role. Spawn one judge with `pstack_spawn`, `role: arena-cross-judge-pool`, and the chosen route's `route_index`. Instruct it to make no writes. The judge is never from the parent's family. Families go by the model id's vendor prefix (`claude-*`, `gpt-*`, `grok-*`, `deepseek-*`, and so on), not by the DSH provider, because one family can reach DSH through several adapters. Try only the routes from another family, in pool order. A pool that inherits runs on the parent model, so it never judges. If `pstack_spawn` refuses a route, move to the next route from another family. If no route from another family runs, skip the judge, pick the base alone in Phase D, and say so. Mapping a route from another family to `arena-cross-judge-pool` in Settings → pstack turns the judge on. If you do not know the parent's model, try the pool's routes in pool order and say that the family check did not run. The judge sees the rubric and the candidates by path label, scores each criterion, and recommends a base with rationale. It runs in parallel with your reading in Phase D. Don't spawn it while candidates are still writing.

## Phase D: Pick a base

Read every candidate end to end before picking. Score each against the rubric criterion by criterion, not on holistic feel, and compare with the cross-judge when Phase C ran one. Agreement on the base confirms the pick. Disagreement means one of you is biased or the rubric was ambiguous. Read both rationales before deciding.

Pick the base a future maintainer can extend most easily without breaking invariants. When two feel tied, prefer the cleaner boundary or smaller API, per the Laziness Protocol.

## Phase E: Graft

Walk each losing candidate once more for what is worth porting into the base, usually one or two things per candidate, not most of it. Fold each graft in by hand, per the **redesign-from-first-principles** principle skill, so the result stays coherent under one mental model. Don't paste mechanically.

If the candidates converge on one shape, that is strong agreement. Note it and ship the consensus shape. No graft is needed. If they wildly diverge, Phase A was under-specified. Reframe and re-run rather than averaging the divergence.

## Phase F: Verify

Verify the synthesized artifact like any other output, per the **prove-it-works** principle skill. If verification finds a problem the arena missed, either Phase A was wrong (re-frame and re-run) or a candidate caught it and you missed the graft (go back to Phase E). Don't paper over it.

## Outputs

One synthesized artifact, with a short synthesis note alongside naming the base and why, the cross-judge's verdict or that Phase C skipped the judge, each graft with its source candidate, what was rejected and why, any convergence or dropouts, and the verification result.

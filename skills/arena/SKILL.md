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
3. Pick the runners. Call `pstack_overlay_read` and read the `arena-runners` role. If it lists routes, run one runner per route with `route_index` 0..n-1. If the role is missing, has `inherit: true`, or has no routes, spawn at least two runners that inherit this conversation. Do not invent provider or model ids. If `pstack_spawn` refuses a route, run that seat on another listed route of the same family or drop the seat, keep at least two runners, and say so. An added runner reuses a remaining route, or runs through the official `subagent` tool, which inherits this conversation, when none remains. Families go by the model id, not the DSH provider, because one family can reach DSH through several adapters. The longest prefix wins: `claude-fable-*`, `claude-*`, `gemini-*`. Any other model id's family is its text before the first hyphen. Spawn more for multiple design directions, and repeat one route when the work is generation-bound, not judgment-sensitive. Reasoning effort comes from the overlay route. Do not send it.
4. Give each candidate its own output location (a git worktree where possible, otherwise `/tmp/arena-<slug>/candidate-<n>/`), per the **separate-before-serializing-shared-state** principle skill.

## Phase B: Fan out

Spawn all N subagents in one message with `pstack_spawn`, `role: arena-runners`, `run_in_background: true`, and `route_index` matching the overlay list when present. Do not send `model`. Follow [`../setup-pstack/references/spawn.md`](../setup-pstack/references/spawn.md). Each gets the task, the path to the shared grounding, its own output path, and instructions to produce the artifact and a short rationale naming the alternatives it considered and what it rejected. The candidate's output directory is the only completion channel: write the required artifact first, then the rationale. Do not invoke `/poteto-mode` from a candidate; it is a parent/session mode and is intentionally not model-invocable in DSH. Treat `send_message` as optional and never wait for it before writing the files.

The candidate prompt must state the exact required filenames and output directory. Candidates should create the directory if needed. A final prose response or settlement message is supplemental and is not evidence of completion.

If a candidate produces no output, proceed with N-1 and note the dropout. Before classifying a dropout, inspect the assigned directory after settlement and distinguish a missing artifact from a missing message or missing usage telemetry.

## Phase C: Cross-judge

After all Phase B candidates complete, call `pstack_overlay_read` and read the `arena-cross-judge-pool` role. Spawn one judge with `pstack_spawn`, `role: arena-cross-judge-pool`, and the `route_index` of the first route from another vendor than the parent. Tell it to make no writes. Fable counts as Claude for that check. A pool that inherits runs on the parent model, so it never judges. Mapping a route from another vendor to `arena-cross-judge-pool` in Settings → pstack turns the judge on. If you do not know the parent's model, use the first route and say that the vendor check did not run. If `pstack_spawn` refuses a route, use the next route from another vendor, or skip the judge and pick the base alone in Phase D, and say so. While you read in Phase D, the judge scores each candidate, by path label, on each rubric criterion and recommends a base.

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

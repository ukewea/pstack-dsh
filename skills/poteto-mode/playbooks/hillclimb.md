### Hillclimb

**You own the metric and the experiment's integrity. Supervise and review. Delegate the attempts.** For sustained, iterative improvement of one measurable thing against a target. A one-off fix is Bug fix or Perf issue.

Core discipline: one change, one measurement, keep or revert. Never stack untested changes, and never claim a win from code inspection. Follow the **prove-it-works** principle skill.

1. Ground the workload and architecture before choosing the metric. Run the **how** skill over the target. Name workload dimensions that can move the result, such as data size, history, state, and concurrency. Select a case that reproduces the user's complaint. If none does, fix the repro instead of hillclimbing. Fix one metric, the direction that counts as better, and a checkable stop predicate with a target and a minimum attempt count. For example, "at least 50% better than baseline and at least 10 iterations". Use the user's numbers when given, otherwise agree them.
2. Build the measurement harness, prove its sensitivity, then freeze it per the **build-the-lever** principle skill. Run contrasting realistic workloads and confirm the target case reproduces the symptom while easier cases separate as expected. If the harness cannot distinguish them, revise the workload or metric. Vet the harness with the **benchmark-checklist** skill before you freeze it, and make it print its error count and a count of the work done. Once frozen, one repeatable command emits the metric, sampled enough to clear the noise. Use a median of N, not a single run. Record the baseline metric and a green run of the regression tests before any change. Changing the harness requires a new baseline.
3. Open the decision log via the **show-me-your-work** skill. A `decision.tsv`, one row per attempt: id, hypothesis, change, before, after, delta, tests, verdict, note. Read it before each attempt. Keep it gitignored so reverts preserve it.
4. Ground each hypothesis in the architecture model from step 1. Name a specific mechanism, such as "defer X off the boot path because it blocks first paint", not "try memoizing something". For a perf metric, order hypotheses by the performance mantras in step 2 of the Perf issue playbook (`playbooks/perf-issue.md`). Borrow only their order, not that step's stop rule.
5. Loop, one hypothesis per iteration:
   - Hand the change to `pstack_spawn` `role: hillclimb` with a tight scope. Routing uses the overlay or inherits the parent. Supervise and review the diff per the **guard-the-context-window** principle skill. Fan independent hypotheses to parallel subagents, each in its own worktree per the **separate-before-serializing-shared-state** principle skill.
   - Measure before and after with the frozen harness, and run the regression tests.
   - Accept only when the metric moves past noise and the tests stay green. Otherwise revert the change in full. A tweak that "might help" is not kept.
   - One commit per accepted fix. Stage only files you changed with `git add <files>`, never `-A`. Log the row either way, kept or reverted.
   Each iteration ends in a check before the next begins per the **sequence-verifiable-units** principle skill. For continued execution, use the goal lifecycle in `playbooks/autonomous-run.md`, keeping this playbook's predicate.
6. Push past the first plateau. After several rejects, pivot category, combine near-misses, re-read the source, or try a different mechanism. Correctness and simplicity outrank the number. Revert a win that breaks behavior, and keep a simplification that holds the number per the **laziness-protocol** principle skill.
7. Stop when the predicate is met, or report that remaining ideas are marginal and not worth their cost. The latter is not goal completion. Don't relax the predicate, and don't quit while cheap untried hypotheses remain. Follow the goal tools' gates when reporting a blocker.
8. Run **Opening a PR** with the accepted commits stacked in the order they landed.

**Reply:** the metric and target, baseline to final with percent delta, iterations kept vs reverted, each accepted fix on one line, the `decision.tsv` path, and the best idea to try next.

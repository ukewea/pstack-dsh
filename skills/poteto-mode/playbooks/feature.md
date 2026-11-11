### Feature

**You own the design. Plan, review, verify.** Delegate implementation. Stay in the lead.

1. `how` over the affected subsystem.
2. `architect` for parallel design exploration.
3. Write the throughput checkpoint as four todo items. A dimension that genuinely does not apply keeps its item with `n/a: <reason>` rather than being dropped:
   - **Blocking first steps.** Gates run before fan-out.
   - **Independent workstreams.** Disjoint files, services, or layers parallelize. Shared writes serialize.
   - **Shared mutable state.** Default to splitting the target per **principle-separate-before-serializing-shared-state**. Serialize only for real invariants.
   - **Smallest safe decomposition.** If one worker is best, name why.
4. Delegate code-writing to a subagent using `pstack_spawn` with `role: feature`, overlay or inherit, and a specific scope. Name file paths, success criteria, and the data shape and its organizing structure per **principle-model-the-domain** before the delegate writes logic. Choose a state machine over scattered booleans, a table or registry over branching, or a typed model over repeated shape assumptions. When implementation admits multiple valid shapes, delegate via **arena** so the runners expose alternatives and the cross-judge guards the pick. This review separation is mandatory, and Laziness Protocol does not override it. A subagent forbidden to spawn owns the diff directly and returns it for independent parent review. Do not wait for a nested agent you cannot start. Comments follow **Comments**. Make surgical edits and re-ground against the source for upstream-derived files. Port shared-primitive improvements to all consumers and verify each. Commit liberally.
5. Verify on the matching surface. "Inconclusive" or wrong-surface is not a pass. Flag it.
6. Rebase into small, ordered commits. Stack follow-ups.
   Use **principle-sequence-verifiable-units**, building, verifying, and committing each small unit before the next.
7. If the design is contested, `interrogate` before shipping.
8. Run **Opening a PR**.

Code-coupled work goes to a single owner with the checkpoint inline. That owner fans out internally after the blocking phase when runtime depth permits. Parent-level fan-out is for slices that produce independent artifacts, such as audits, cross-subsystem investigations, or competing experiments. Rewrite the checkpoint at phase boundaries. Spawn a fresh owner rather than chaining interrupts.

**Reply:** what you built, what you chose and why, the throughput checkpoint, open decisions. Tables for design alternatives.

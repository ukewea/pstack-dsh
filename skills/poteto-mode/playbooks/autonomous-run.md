### Autonomous run

**You own the exit condition. Define done, then drive to it without stopping.**

1. State the exit condition as a checkable predicate before the first iteration, such as tests green, repro fixed, all N PRs merged, or pixel-diff zero.
2. Use DSH goal tools for continued execution of a long-running objective. Call `get_goal` before changing an existing goal. Create one with `create_goal` when none exists, or use `update_goal` to resume it after a direct human request to continue. Follow the tools' lifecycle gates. If goal tools are unavailable, continue in the current turn and leave a checkpoint if execution stops. Do not promise timed wakeups or unattended polling.
3. Each iteration makes the smallest change the evidence justifies, verifies it against the predicate, commits if it advanced, and discards changes that didn't help.
   Sequence the work via the **sequence-verifiable-units** principle skill, verifying each unit before the next instead of batching checks at the end.
4. Address mid-run discoveries that support the goal, within the authorized scope, via poteto-mode. Put out-of-band fixes in their own PR when authorized. Do not park reversible work for the human. Ask only for required permission, irreversible actions, product or preference calls no experiment can settle, or a real dead end. Return to the predicate after each side fix.
5. Checkpoint every iteration via the **show-me-your-work** skill, a row for what changed and whether the predicate moved.
6. Stop when the predicate is met and mark the goal complete only after verification. A plateau means pivot, not success. Report a genuine blocker through the goal tools when their gates allow it. Never relax the predicate to declare victory.

**Reply:** the exit condition, iterations run, what landed, what was discarded, final predicate state.

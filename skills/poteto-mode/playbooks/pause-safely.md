### Pause safely

**You own a clean stop. Leave a checkpoint a cold-start agent can resume from.** This is explicit only. On "keep going", "going to bed, keep going", or "don't stop", do not pause.

1. Stop at a safe boundary. Finish the current atomic step or back out of it. Start nothing new. Interrupt nested subagents and stop background jobs that must not continue. If a goal is active, call `get_goal`, then `update_goal` with `action: pause` for the explicit human pause request.
2. Take no irreversible action to pause. No PR and no push unless you already had one out.
3. Make the work durable. Commit your uncommitted edits as one clear `wip:` commit on the current branch when commits are in scope. Preserve unrelated edits. If the tree is broken, say so in the commit body in one line.
4. Write the resume note off-context. Capture intent, progress, what's verified, current state, next steps, key files, and gotchas. Before compaction, write a file in an allowed workspace path. If a show-me-your-work trail exists, point at it instead of duplicating it. A compaction checkpoint alone is not a request to pause an active goal.

**Reply:** where you are in the loop, what's on disk versus still in your head, the paths and commits, whether the tree is clean, and the first action on resume. This is a pause, not a final report.

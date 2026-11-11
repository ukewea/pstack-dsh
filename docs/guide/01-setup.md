# Set up pstack

In this page you install the plugin, pick which models pstack uses, and run your first task. Setup is one command, then the Settings page if you want per-role routes.

## Install the plugin

Need **pnpm** on `PATH`. Then:

```sh
dsh plugin --profile web add github:aa2246740/pstack-dsh
```

Restart that Host and reload the page. Add writes `$DSH_HOME/profiles/web`; it does not hot-load a running process.

## Pick your models

Open **Settings** (sidebar gear) → **pstack** (nav **pstack 角色** / **pstack roles**).

The page lists only logged-in DSH routes. Save writes `$DSH_HOME/pstack-dsh.json`. A missing file means every role inherits this conversation.

Each mapped route can also carry a reasoning effort, picked from the efforts that route lists. There is no single reasoning budget for all roles. Raise or lower the effort route by route.

You only override what you care about. A role left as `inherit-parent` keeps the parent route. `auto` means the same inherit. For a panel role the value is a list, and one subagent runs per entry. Setup also configures `swarm-workers`, the default route for every `/swarm` worker unless a race names a selectable catalog route for each arm.

[`/setup-pstack`](../../skills/setup-pstack/SKILL.md) is a pointer to that page. It is not a TUI editor.

New `pstack_spawn` calls pick up the overlay in this session.

## Add verification skills

In DSH, `/setup-pstack` does not scan the project or offer to generate anything. Run these skills yourself when they fit.

If the project has no way to prove app behavior, generate one with [`/create-verification-skill`](../../skills/create-verification-skill/SKILL.md). It writes `.dsh/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers it in depth.

If you're new to pstack, run it. An agent that can check its own work keeps going until the check passes. An agent that can't hands every result back to you to check by hand. Of everything in this guide, the verification skill pays off the most.

[`/create-formal-verification-skill`](../../skills/create-formal-verification-skill/SKILL.md) generates a formal verification skill. Tests check the cases someone thought to write. A formal verification skill checks one key property of your code, such as "a job never runs twice at once", in every case within a stated scope. Run it when your code has concurrency, retries, a state machine, or a parser, where a bug is costly and tests rarely reach the case that breaks. [Verify and ship](./06-verify-and-ship.md#prove-a-property-with-a-formal-verification-skill) covers it.

## Keep the cost in check

pstack spends extra tokens on subagents and review panels. That's the price of the rigor. To spend fewer:

- In Settings → pstack, map the code roles to cheaper routes, or pick a lower effort on a route. A strong model in the main chat with cheaper, faster models in the code roles is a good split.
- Set a role to `auto` or `inherit-parent` so it runs on the chat's own model.
- Shorten a panel list. Each entry runs one subagent.
- Save `/poteto-mode` for work that needs rigor. A small, obvious edit doesn't.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
/poteto-mode add a --json flag to this command. text output stays byte-identical. verify both.
```

Watch the todo list. Its first items are the matched playbook's steps copied in, the Feature playbook for this prompt. If `/poteto-mode` skips a step, the step stays in the list with `skip: <reason>`, so you can see what it chose not to do.

From here you can type normal follow-ups. `/poteto-mode` attaches the skill to the message you typed it in. DSH has no Cursor Custom Mode that keeps a skill in context on every turn, so it can fade as the chat grows or after compaction. Type `/poteto-mode` again on a later message that needs it.

Next: [Route work through `/poteto-mode`](./02-poteto-mode.md).

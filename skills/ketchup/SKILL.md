---
name: ketchup
description: "Catch the user up on what changed in this chat since their last message, in plain words and small visuals. List every item waiting on them with what they need to decide it from the reply alone. Use for /ketchup."
disable-model-invocation: true
---

# Ketchup

Catch the user up on what changed in this chat since the last message they wrote before `/ketchup`, and help them understand each change, not only where it stands. Then lay out every call waiting on them so they can make it from your reply alone. Assume the user remembers their last message and nothing after it.

In DSH many messages that are not the user's arrive with the user role. Count only text the user typed. These are never the user's messages: `<skill_content>` blocks, `<goal_round>` messages, `<compacted-summary>` checkpoints, runtime and sandbox context, `AGENTS.md` and file-change notices, subagent and `pstack_spawn` completion notices, and session snapshots pulled in with `@`.

Use [`/bro`](../bro/SKILL.md)'s voice, not its task: plain words, short sentences, no jargon, like one person catching up another. Say what changed for the user, not how you did it. Say "the tests pass", not "CI is green". Leave out hashes, file paths, commands, build numbers, and test counts unless the user needs one to act. Call each PR, branch, or agent by a name the user would know, not by a label you invented. If a fact needs context to make sense, give the context or leave the fact out.

## Gather what changed

Keep this turn read-only. Make visuals only from what you already have: do not change code, start an app or a job, or post anything. The one exception is a diagram file under `/tmp/pstack-ketchup/` (see Visuals). Collect your own work since that message, reports from subagents, and messages from anyone else in this chat. Check the current state of each PR, CI run, or agent this chat touched: PRs and CI with `gh` when it is installed and signed in, agents with `list_agents` or the `pstack_spawn` results in this chat. If the start of the window or later work survives only as a `<compacted-summary>`, recover it with `session_event_search` and `session_event_read` on this session when those tools are present; otherwise say in one line that part of the history is only a summary. Never fill a gap by guessing. Check each number you will show against the facts it comes from, and say so when you correct one.

An action item is a call or step only the user can take, such as a product choice, an approval, an irreversible action, or access you lack. Include any still waiting on the user, even one raised before their last message. Work you can still do yourself is not an action item. Never make up a call to fill the reply. A step the user did not ask for and the work does not need is not an action item, unless it is irreversible and waiting on the user: give it one line and no visual.

One call can cover many items, such as each PR in a set awaiting merge. For each item, collect its link, what it changes for users, the evidence behind your pick, its risk, and your pick. Write "unknown" for a fact the call needs that you do not know. Leave out a link you do not have.

## Write the reply

Spend words on the calls, not on the story. Keep what happened under 100 words, not counting pictures, and shorter when less happened. Leave out work that changed nothing for the user. Give each item about 30 words. The reply grows with the number of items: two items need well under 150 words in all, not counting pictures, and thirty need far more. Never cut items or shrink them to stay under a word count: no count in place of a list, and no link in place of an item. A link can add depth, but the reply alone must be enough to decide.

Open with one short sentence that names what waits on the user, or says nothing does. The action items give the detail. If nothing happened and nothing waits on the user, say so and stop.

Then show what happened, pictures first. Embed inline the screenshots the work produced, then any diagram that explains a change, and link its videos. Then sum up in one short bullet per thing the user asked for: what came of it, and whether it is done, still running, failed, or not checked. Write each line the way you would say it out loud: "Search was slow from a missing index", not "Search review: done" or "Slow search: missing index". Name any bug found and fixed on the way. Each line must stay true when read alone. Never mark something done that still waits on the user, and leave out anything the action items say. Under the summary, give at most three short lines that change what the user knows or must do. Then name in one line any work left that you can do yourself.

Then list the action items. Ask the call the user owns, such as merge, approve, or pick, and give your pick. A step you would take first goes in your pick. So does anything that must happen first, and anything that cannot be undone. Give the number or link of each PR, issue, or agent a call is about, also in a call between options.

Fit the shape to the call. A call about one item is one bullet: the call, your pick, what it changes for users, the evidence behind your pick, and its risk, with the item named once. When items share a call, write the call and your pick once, then give each item its own bullet, riskiest first: its link and name, what it changes for users, the evidence behind your pick, and its risk. Name an item's pick only where it differs from the call's. Give each item's risk even when it is low, such as "Low risk: only the colors change." Say what waiting costs only when it is more than a delay, such as a deadline or lost data.

For a call between options, give every option the work weighed, each with what it gets the user and what it costs, and the current state when there is one. Those costs are the call's risk, so add no separate risk line. When the screenshots above show the options, write each option's gain and cost under its screenshot.

## Visuals

A visual is a picture: a screenshot, a GIF or PNG the work produced, or a small SVG diagram you draw. A Markdown table is not a visual, even with before and after columns.

DSH Web shows an image inline from `![alt](</absolute/path>)`, SVG included. It does not draw Mermaid, play video inline, or render raw HTML, and it has no chart or image-generation tool. Give a video as a link, or show it with `present`, and say in its summary line what changed on screen.

When something is easier to grasp as a picture than as sentences, draw it as an SVG: how a design or system works, a PR stack or dependency chain with each PR's state, a before and after of a fix, or options side by side. Never draw a status list, a list of action items, or boxes with nothing connecting them. Never give a fact twice, in text or across visuals.

Keep each diagram small enough to read at a glance: at most six boxes, with at most eight words in each. Write labels as plain words a person would say, not tags like "Tests: pass". A fact that needs a sentence belongs in the text, or nowhere.

How to draw one in DSH:

- Write it with the write tool to `/tmp/pstack-ketchup/<short-name>.svg`. This is the one file this turn may write: it is outside the repo and changes nothing the user owns. Then embed it with its absolute path.
- Plain SVG only: shapes, lines and `<text>`, colored with presentation attributes such as `fill`, `stroke` and `font-size`. DSH serves files under `default-src 'none'`, so `<style>`, `style=""`, scripts, external fonts and linked images do not render.
- Set `width`, `height` and `viewBox`, keep it under about 640 by 320, and use a light fill with dark text so it reads in both themes.

Embed screenshots inline when the change is visible, not only as links. If a visible change has none, mark its summary line "No screenshot yet," and say there what changed on screen. Draw diagrams only from facts you have. Never invent a number, and never draw a screen you did not capture. Link only artifacts that exist.

# official pstack 的 DeepSeek Harness 移植

## 安装 / Install

### 官方 DeepSeek Harness 桌面 App（推荐） / Desktop app (recommended)

打开 **设置 → 插件 → 添加插件**，在“包名或地址”中输入：

Open **Settings → Plugins → Add plugin** and enter this in “Package name or address”:

```text
github:ukewea/pstack-dsh#v0.3.0
```

桌面端插件管理器负责 Desktop profile 和内置包管理器。本发布已包含编译好的 `lib/`；普通使用不需要 clone 或本地构建。若应用提示刷新或重新打开，请按提示完成。

The desktop plugin manager owns the Desktop profile and bundled package manager. This release includes built `lib/`; normal use needs no clone or local build. Follow the app if it asks you to reload or reopen after installation.

### Web CLI

```sh
dsh plugin --profile web add github:ukewea/pstack-dsh#v0.3.0
```

这条官方 CLI 命令只写入 `web` profile，不能修改 Desktop App 的 profile。对于已运行的 Web Host，请重新打开该 Host 一次，再刷新网页。

This official CLI command writes only the `web` profile; it cannot modify the Desktop App profile. For an already-running Web Host, reopen that Host once and reload the page.

面向官方 DeepSeek Harness **0.2.2-rc.1**（tag `dsh-v0.2.2-rc.1`，npm `@deepseek-ai/dsh@0.2.2-rc.1`）。Node `^22.19.0` 或 `>=24`。`@deepseek-ai/dsh-*` peer 范围是 `>=0.2.2-rc.1 <0.2.3`，接受 `0.2.2-rc.1`，拒绝 `0.2.2` alpha 与 `0.2.1`、`0.2.0` 系列。DSH `0.2.1` 请使用 pstack-dsh `0.2.5`。

Targets official DeepSeek Harness **0.2.2-rc.1** (tag `dsh-v0.2.2-rc.1`, npm `@deepseek-ai/dsh@0.2.2-rc.1`). Node `^22.19.0` or `>=24`. The `@deepseek-ai/dsh-*` peer range is `>=0.2.2-rc.1 <0.2.3`: it accepts `0.2.2-rc.1` and rejects `0.2.2` alphas and the `0.2.1` and `0.2.0` series. For DSH `0.2.1`, use pstack-dsh `0.2.5`.

**English title.** pstack-dsh, a DeepSeek Harness port of official pstack.

**中文.** 这是 official pstack 的 DeepSeek Harness 移植。玩法和原则来自 poteto 的 official pstack；只有调用层换成 DSH。

**English.** This is a DeepSeek Harness port of official pstack. Playbooks and principles are poteto's. Only the harness call layer is swapped.

## 来源 / Credits

23 个玩法（playbooks）和 24 条原则（principles）是 [poteto](https://x.com/poteto) 写的，出自 [official pstack](https://github.com/cursor/plugins/tree/main/pstack)。本仓库是 DeepSeek Harness 移植：最初由 [aa2246740/pstack-dsh](https://github.com/aa2246740/pstack-dsh) 完成，现由 [ukewea/pstack-dsh](https://github.com/ukewea/pstack-dsh) 继续维护。调用层用 [HARNESS.md](./HARNESS.md) 里的 DSH 工具名。玩法和原则不是本仓库写的。

The 23 playbooks and 24 principles are [poteto](https://x.com/poteto)'s, from [official pstack](https://github.com/cursor/plugins/tree/main/pstack). This repository is the DeepSeek Harness port, first made by [aa2246740/pstack-dsh](https://github.com/aa2246740/pstack-dsh) and now maintained at [ukewea/pstack-dsh](https://github.com/ukewea/pstack-dsh). Harness calls use DSH tools named in [HARNESS.md](./HARNESS.md). This port did not author those playbooks or principles.

## 本地目录 / Local checkout

已经 clone 到本机时（开发/本地测试）：

A local checkout (development/local testing):

```sh
git clone https://github.com/ukewea/pstack-dsh.git
dsh plugin --profile web add ./pstack-dsh
```

然后同样重启 Host，再刷新页面。

Then restart that Host and reload the page.

```sh
dsh plugin --profile web remove pstack-dsh
```

Desktop App 请使用上面的应用内“添加插件”入口。官方 CLI 只管理 `web` profile。

Use the in-app “Add plugin” entry above for the Desktop App. The public CLI manages the `web` profile only.

## 开始用 / Get started

两步。

Two steps.

1. 要做事、要严谨，直接用 [`/poteto-mode`](./skills/poteto-mode/SKILL.md)。不用先跑 setup。子 agent 默认继承当前对话的路由。
2. 只有想给某个角色换已登录的路由时，打开 **设置 → pstack**（导航「pstack 角色」/「pstack roles」）。页面写入 `$DSH_HOME/pstack-dsh.json`。[`/setup-pstack`](./skills/setup-pstack/SKILL.md) 只是指向那一页的指针。

1. Use [`/poteto-mode`](./skills/poteto-mode/SKILL.md) for work that needs rigor. No setup required. Children inherit this conversation's route.
2. To pin a logged-in route per role, open **Settings → pstack** (nav label **pstack 角色** / **pstack roles**). The page writes `$DSH_HOME/pstack-dsh.json`. [`/setup-pstack`](./skills/setup-pstack/SKILL.md) is an optional pointer to that page.

角色模型列表会随 DSH 的登录、退出登录和模型目录变更通知更新，也可点击「刷新模型列表」。刷新只更新候选项，不覆盖尚未保存的角色和 effort；当前选择若失去登录会标为「暂不可用」。新加入 dsh-oauth-login 的 `pi-*` 路由以及 dsh-antigravity-oauth 的 `agy-*` 路由只要已登录且已注册，就会自动纳入，无需在 pstack 里再维护一份提供商名单。

Model choices follow DSH login/logout and catalog notifications. **Refresh models** also updates the choices without replacing unsaved role/effort edits. A selected route that becomes unavailable stays visibly marked. Newly registered, signed-in `pi-*` and `agy-*` routes are discovered without a second provider allowlist.

The locally authenticated `cursor` provider is also discovered when
[dsh-cursor-passthrough](https://github.com/mingzhong15/dsh-cursor-passthrough)
is installed and exposes live models. This lets a DSH parent assign a pstack
role to a Cursor subscription model without storing Cursor credentials in DSH.

安装并启用 [dsh-cursor-passthrough](https://github.com/mingzhong15/dsh-cursor-passthrough)
后，pstack 也会发现由本机 Cursor CLI 登录的 `cursor` 提供商。这样 DSH 父对话可以把指定角色分配给 Cursor 订阅模型，无需在 DSH 中保存 Cursor 凭据。

For mixed routing, keep the parent conversation on a native DSH provider and
assign Cursor models to selected roles in **Settings → pstack**. `pstack_spawn`
then routes those children through Cursor. If the parent itself uses Cursor
passthrough, it runs through Cursor ACP and cannot call DSH-only tools such as
`pstack_spawn`; use Cursor's own subagents in that case.

混合路由时，请让父对话使用 DSH 原生提供商，再在 **设置 → pstack** 中把部分角色分配给 Cursor 模型。若父对话本身使用 Cursor passthrough，该轮会通过 Cursor ACP 执行，无法调用 `pstack_spawn` 等 DSH 专用工具；此时请使用 Cursor 自带的子代理。

第一次用可以看 [pstack 指南](./docs/guide/README.md)。

New here? The [pstack guide](./docs/guide/README.md) walks through a first real task.

其余技能是按需的。`/poteto-mode` 会在步骤需要时自己去调。

The other skills are situational. The mode skill uses them when a step needs them.

## 玩法、技能与原则 / Playbooks, skills, and principles

下面的表格沿用上游 pstack 的英文说明，只列出本移植附带的内容。

The tables below keep upstream pstack's descriptions and list only what this port ships.

### `/poteto-mode`

`/poteto-mode` 收到任务后会：

1. 把任务匹配到一个[玩法](./skills/poteto-mode/playbooks/)，并开一个 todo 列表，前几项是原样抄入的玩法步骤。
2. 在步骤需要时调用其他技能。
3. 以去除 AI 腔的文字回复，面向使用者和维护者。

When invoked, `/poteto-mode`:

1. matches your task to a [playbook](./skills/poteto-mode/playbooks/) and opens a todo list whose first items are its steps, copied in verbatim.
2. routes to the other skills as the steps fire.
3. writes unslopped replies framed for the consumer and the maintainer.

完整规则在 [`skills/poteto-mode/SKILL.md`](./skills/poteto-mode/SKILL.md)。DSH 没有 Cursor 的 Custom Mode，`/poteto-mode` 只附在你输入它的那条消息上。之后的消息要开始新工作时，请再输入一次。

The full rules live in [`skills/poteto-mode/SKILL.md`](./skills/poteto-mode/SKILL.md). DSH has no Cursor Custom Mode, so `/poteto-mode` attaches only to the message you type it in. Type it again when a later message starts new work.

<details>
<summary>23 个玩法 / the twenty-three playbooks</summary>

| playbook | for |
|---|---|
| [investigation](./skills/poteto-mode/playbooks/investigation.md) | a read-only question. how does x work, why was y built this way, are we sure. |
| [bug fix](./skills/poteto-mode/playbooks/bug-fix.md) | reproduce a defect, root-cause it, and fix with runtime evidence. |
| [perf](./skills/poteto-mode/playbooks/perf-issue.md) | trace a measured slowness and improve it against a baseline. |
| [hillclimb](./skills/poteto-mode/playbooks/hillclimb.md) | sustained, scientific improvement of one metric against a target, looping hypotheses with before/after measurement and one commit per accepted win. |
| [runtime forensics](./skills/poteto-mode/playbooks/runtime-forensics.md) | diagnose a live symptom (leak, idle-cpu spin, glitch) from instrumentation. |
| [trace forensics](./skills/poteto-mode/playbooks/trace-forensics.md) | diagnose a captured profiling artifact (cpuprofile, trace, spindump, heap snapshot). |
| [feature](./skills/poteto-mode/playbooks/feature.md) | new or changed behavior, built from a named data shape. |
| [refactoring](./skills/poteto-mode/playbooks/refactoring.md) | a behavior-preserving change to structure or shape. |
| [prototype](./skills/poteto-mode/playbooks/prototype.md) | a throwaway sketch to make a design or behavioral decision cheaply, or to settle an empirical fork by observing it. |
| [visual parity](./skills/poteto-mode/playbooks/visual-parity.md) | pixel-exact ui equivalence between two implementations. |
| [authoring a skill](./skills/poteto-mode/playbooks/authoring-a-skill.md) | writing or editing a SKILL.md. |
| [eval](./skills/poteto-mode/playbooks/eval.md) | test how a skill or prompt change affects agent behavior, blinded. |
| [babysit](./skills/poteto-mode/playbooks/babysit.md) | drive a pr or a stack to merge-ready: conflicts, review threads, ci. |
| [shipping](./skills/poteto-mode/playbooks/shipping.md) | independently verify a green stack, then land the contiguous verified run bottom-up through github by default or origin when available. |
| [autonomous run](./skills/poteto-mode/playbooks/autonomous-run.md) | drive a long task to completion without stopping. |
| [orchestrate](./skills/poteto-mode/playbooks/orchestrate.md) | a standing project handed to one coordinator chat: multi-day, many stacked prs, fleets of subagents. |
| [autopilot-full](./skills/poteto-mode/playbooks/autopilot-full.md) | run independent prs to merged with one owner per pr. a swarm verifies each code-ready head, and every later change to the patch gets a fresh check. |
| [autopilot-stack](./skills/poteto-mode/playbooks/autopilot-stack.md) | autopilot-full without the merge. build and verify prs for the operator to review and land, stacking a pr only on a pr it builds on. |
| [session pickup](./skills/poteto-mode/playbooks/session-pickup.md) | resume or take over a prior agent's in-flight work. |
| [pause safely](./skills/poteto-mode/playbooks/pause-safely.md) | suspend in-flight work cleanly so it can be resumed later. |
| [multi-phase plan](./skills/poteto-mode/playbooks/multi-phase-plan.md) | work that spans phases or stacked PRs. |
| [worktree cleanup](./skills/poteto-mode/playbooks/worktree-cleanup.md) | reclaim disk by pruning merged or abandoned worktrees and stale ios simulators, safety-gated. |
| [opening a pr](./skills/poteto-mode/playbooks/opening-a-pr.md) | open a ready pr from small ordered commits with a conventional commits title and a briefing-style body. invoked at the end of every other playbook. |

</details>

### 技能 / Skills

`/poteto-mode` 会在步骤需要时替你运行其中大部分技能（`how`、`why`、`architect`、`arena`、`swarm`、`interrogate`、`unslop`、`no-comments`、`technical-writing`、`tdd` 以及各条原则），做法是按路径读取对应的 bundled `SKILL.md`。想直接用某个技能时，输入 `/名称`。

`/poteto-mode` runs most of these for you when a step needs them (`how`, `why`, `architect`, `arena`, `swarm`, `interrogate`, `unslop`, `no-comments`, `technical-writing`, `tdd`, and the principles). It reads each one from its bundled `SKILL.md` by path. The table is for when you want one directly, by typing `/<name>`.

<details>
<summary>全部技能 / all skills</summary>

| skill | use it when |
|---|---|
| [`/poteto-mode`](./skills/poteto-mode/SKILL.md) | default entry point for any non-trivial task. |
| [`/in-your-own-words`](./skills/in-your-own-words/SKILL.md) | you want the agent to play back your goal and the problem before it starts. runs only when you type `/in-your-own-words`. |
| [`/sharpen`](./skills/sharpen/SKILL.md) | you want a prompt made deeper, not bigger, before you send it: what a top professional would do that you didn't ask for, the raw material they'd start from, their methods and tools, and an outside check that the result is right. hands back the rewritten prompt and leaves your choices open. doesn't do the task. runs only when you type `/sharpen`. |
| [`/how`](./skills/how/SKILL.md) | you want a walkthrough of how a subsystem works. |
| [`/why`](./skills/why/SKILL.md) | you want to know why something was built this way. discovers available MCPs at run time and queries each evidence category in parallel (source control, issue tracker, long-form docs, real-time chat, infra observability, error tracking, analytics warehouse). |
| [`/recall`](./skills/recall/SKILL.md) | you're starting or resuming work and want your recent context on a topic rebuilt from your own chat history and the shared record, handed back as a tight current-state brief. |
| [`/ketchup`](./skills/ketchup/SKILL.md) | you want what changed in this chat since your last message, in plain words and small visuals, with every item waiting on you listed and decidable from the reply alone, even when that makes the reply long. |
| [`/blast-radius`](./skills/blast-radius/SKILL.md) | you have a small-looking change and want to know what else it could break, with the one fact it's safe because of proven by running code, not asserted. |
| [`/architect`](./skills/architect/SKILL.md) | you're about to write code that crosses a function boundary and want the caller's usage, types, and module shape settled first. |
| [`/arena`](./skills/arena/SKILL.md) | you want N parallel attempts at the same thing, then to grab the best parts of each. |
| [`/swarm`](./skills/swarm/SKILL.md) | you want N parallel workers across different slices or races, then one aggregated report. |
| [`/interrogate`](./skills/interrogate/SKILL.md) | you have a diff and want different models to try to break it, keeping only findings a run proves. |
| [`/automate-me`](./skills/automate-me/SKILL.md) | you want your own `-mode` skill, drafted from how you've actually worked. |
| [`/setup-pstack`](./skills/setup-pstack/SKILL.md) | you want to pick which models pstack uses per role. points you at **Settings → pstack**, which writes `$DSH_HOME/pstack-dsh.json`. |
| [`/reflect`](./skills/reflect/SKILL.md) | a long task landed and you want the recipe captured as a skill edit. |
| [`/correct`](./skills/correct/SKILL.md) | you keep correcting agents for the same mistakes. mines history for mistake classes, fixes each at the highest level that works (architecture, then types, lint, and ci, then tests, with docs last), and keeps a table pairing each rule with what enforces it. |
| [`/teach`](./skills/teach/SKILL.md) | you want to actually understand a change or subsystem, not just have it summarized. runs how + why and weaves one plain explanation, built up diagram by diagram. |
| [`/tdd`](./skills/tdd/SKILL.md) | you're fixing a bug and there's a cheap local test path. write the failing test first, then the fix. |
| [`/benchmark-checklist`](./skills/benchmark-checklist/SKILL.md) | you ran a benchmark or measured a speedup or regression. vets the number (limiter, tuning, errors, repeat runs, end-to-end relevance) before you report or act on it. |
| [`/no-comments`](./skills/no-comments/SKILL.md) | strip comments before review; spawns Comment Sicko, fixes accepted findings, offers encodings for claimed constraints. |
| [`/typescript-best-practices`](./skills/typescript-best-practices/SKILL.md) | you're reading or editing typescript. grounds the type-system-discipline principle in syntax. |
| [`/figure-it-out`](./skills/figure-it-out/SKILL.md) | no bundled playbook fits. designs a rigorous, auditable playbook for the task. |
| [`/show-me-your-work`](./skills/show-me-your-work/SKILL.md) | you want a reviewable decision trail. logs decisions to a tsv you can commit. |
| [`/create-verification-skill`](./skills/create-verification-skill/SKILL.md) | your project has no scripted way to prove app behavior. generates a project-local verify skill with a feature map, for any language or platform. |
| [`/maintain-verification-skill`](./skills/maintain-verification-skill/SKILL.md) | your verify skill's feature map has drifted from the app. source wave + one live pass, at most one PR of proven corrections. |
| [`/create-formal-verification-skill`](./skills/create-formal-verification-skill/SKILL.md) | tests can't reach the case that breaks a race, retry, state machine, parser, or unsafe code. verifies one property with the tool that fits and generates a project-local skill to recheck it on every change. |
| [`/maintain-formal-verification-skill`](./skills/maintain-formal-verification-skill/SKILL.md) | code your formal verification covers has changed since it was last checked. updates the model, harness, or properties to match the code, reruns, and says whether each failure is drift in the verification or a bug in the code. |
| [`/statechart`](./skills/statechart/SKILL.md) | someone who owns the behavior needs to see it, not read a spec. checks a tla+ model, draws what the user sees as a mermaid statechart, marks each state that breaks a rule, and gives the shortest path to each one. |
| [`/unslop`](./skills/unslop/SKILL.md) | you're cleaning up writing. removes AI tells. |
| [`/bro`](./skills/bro/SKILL.md) | you want the last message restated in plain human language, no jargon. |
| [`/technical-writing`](./skills/technical-writing/SKILL.md) | layered doc standard (Diátaxis + Google developer style + STE + Global English) for docs, RFCs, readmes, PR descriptions, commit messages. |

</details>

### 原则 / Principles

24 条短技能，每条一个原则。`poteto-mode` 内含它们的索引，并在任务开始时读取索引。某条原则适用时，它按路径读取 bundled 的 `principle-*/SKILL.md` 全文。

Twenty-four short skills, one principle each. `poteto-mode` indexes them inline and reads that index at task start. When a principle applies, it reads the full rule from the bundled `principle-*/SKILL.md` file by path.

<details>
<summary>24 条原则 / all twenty-four principles</summary>

| principle | group | rule |
|---|---|---|
| [laziness-protocol](./skills/principle-laziness-protocol/SKILL.md) | core | Bias toward deletion and the smallest change that solves the problem. |
| [foundational-thinking](./skills/principle-foundational-thinking/SKILL.md) | core | Apply before writing logic: choosing core types and data structures, sequencing scaffold-vs-feature work, asking what concurrent actors share. Get the data structures right so downstream code becomes obvious. |
| [redesign-from-first-principles](./skills/principle-redesign-from-first-principles/SKILL.md) | core | Redesign as if the requirement had been a foundational assumption from day one, instead of bolting it on. |
| [attack-the-premise](./skills/principle-attack-the-premise/SKILL.md) | core | Apply when two or more fixes that share one premise have failed the same gate. Write the premise down and test it directly before you write another fix that assumes it. |
| [subtract-before-you-add](./skills/principle-subtract-before-you-add/SKILL.md) | core | Remove dead weight, redundant validators, and stub references first, then build on the simpler base. |
| [minimize-reader-load](./skills/principle-minimize-reader-load/SKILL.md) | core | Count layers between question and answer, and hidden state in the reader's head; collapse one-caller wrappers and shrink mutable scope. |
| [outcome-oriented-execution](./skills/principle-outcome-oriented-execution/SKILL.md) | core | Apply during planned rewrites and migrations with explicit phase boundaries. Converge on the target architecture; don't preserve smooth intermediate states with throwaway compatibility code. |
| [experience-first](./skills/principle-experience-first/SKILL.md) | core | Choose user delight over implementation convenience; ship fewer polished features over more rough ones. |
| [exhaust-the-design-space](./skills/principle-exhaust-the-design-space/SKILL.md) | core | Build 2-3 competing prototypes and compare side by side before committing. |
| [build-the-lever](./skills/principle-build-the-lever/SKILL.md) | core | Apply to any non-trivial work, not just bulk work: edits, migrations, analyses, checks. Build the tool that does it or proves it (codemod, script, generator, or a skill your subagents follow) instead of working by hand. The tool is the artifact a reviewer can rerun. |
| [model-the-domain](./skills/principle-model-the-domain/SKILL.md) | architecture | Encode the domain in a structure instead of scattered conditionals. |
| [boundary-discipline](./skills/principle-boundary-discipline/SKILL.md) | architecture | Concentrate guards at system boundaries (CLI, config, network, external APIs); trust internal types and keep business logic in pure functions. |
| [type-system-discipline](./skills/principle-type-system-discipline/SKILL.md) | architecture | Make illegal states unrepresentable, brand semantic primitives, parse external data at boundaries, exhaust variants, derive from authoritative schemas. |
| [make-operations-idempotent](./skills/principle-make-operations-idempotent/SKILL.md) | architecture | Converge to the same end state regardless of partial prior runs. |
| [migrate-callers-then-delete-legacy-apis](./skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md) | architecture | Migrate callers and delete the old API in the same wave instead of preserving compatibility layers. |
| [separate-before-serializing-shared-state](./skills/principle-separate-before-serializing-shared-state/SKILL.md) | architecture | Eliminate the sharing first; serialize structurally only when one shared writer is a real invariant. |
| [prove-it-works](./skills/principle-prove-it-works/SKILL.md) | verification | Apply after completing a task, before declaring done. Verify against the real artifact (run the feature, read the actual value, inspect the diff), not a proxy, self-report, or 'it compiles.'. |
| [fix-root-causes](./skills/principle-fix-root-causes/SKILL.md) | verification | Trace each symptom back to the first place the system went wrong and fix it there. A guard is a fix only when the state it handles is legitimate. |
| [sequence-verifiable-units](./skills/principle-sequence-verifiable-units/SKILL.md) | verification | Apply to multi-step work (sweeps, migrations, runs of similar edits) and to how you stack commits and PRs. Break work into small units that each end in a verifiable state, check each before the next, and order delivery so the sequence proves itself to a reviewer. |
| [test-behavior-not-implementation](./skills/principle-test-behavior-not-implementation/SKILL.md) | verification | Apply when you write, change, or keep a test. Assert what the code's users can observe, so the test fails when that behavior breaks and keeps passing when only the internals change. |
| [explain-the-number](./skills/principle-explain-the-number/SKILL.md) | verification | Apply before you trust, report, or act on a number you measured: a speedup, a regression, a throughput, a latency, or an eval result. Find what limits it, and rule out that it measured something other than the work you think. |
| [guard-the-context-window](./skills/principle-guard-the-context-window/SKILL.md) | delegation | Route bulk to subagents; keep summaries in the main thread, not raw payloads. |
| [never-block-on-the-human](./skills/principle-never-block-on-the-human/SKILL.md) | delegation | Proceed, present the result, let the human course-correct after the fact; reserve confirmation for irreversible actions. |
| [encode-lessons-in-structure](./skills/principle-encode-lessons-in-structure/SKILL.md) | meta | Encode the rule as a lint, metadata flag, runtime check, or script instead of more text. |

</details>

## 上游 0.15 同步 / Upstream sync

技能内容同步至 `cursor/plugins` 的 pstack 0.15.36，提交 `de8ee15dd1194627d21eb5fcd41cb1873208dabb`。保留 DSH 工具和角色路由。未包含 Cursor 专用的 make-bot-ui、poteto-help 和 automations，也未包含 ketchup-video（DSH 没有视频渲染，网页对话不能播放 mp4）。

Skill content is synced to pstack 0.15.36 from `cursor/plugins` (commit `de8ee15dd1194627d21eb5fcd41cb1873208dabb`), keeping DSH tools and role routing. Not included: Cursor-only make-bot-ui, poteto-help and automations, and ketchup-video (DSH has no video renderer and its web chat cannot play mp4).

设置页的「Poteto 0.15 推荐」仅供参考，不会替换用户已保存的模型或 effort。`how-critics` 不再显示或启动代理，旧配置仍可读写并保留。不包含 Cursor 专用的 make-bot-ui。

The Poteto 0.15 recommendations are display-only. Existing model and effort assignments remain unchanged. The retired `how-critics` setting stays readable for compatibility but is hidden and never starts an agent. Cursor-only make-bot-ui is not included.

## 默认模型与 effort / Defaults

装完就能用，不必先打开设置，也不必跑 `/setup-pstack`。

A fresh install is usable without Settings → pstack and without `/setup-pstack`.

**模型 / Model.** 不要发送 `model`，除非 live catalog 里已经有这一条。没有 overlay 就继承父对话。不要编造 Cursor 面板 slug（`grok-4.6-fast-xhigh`、`gpt-5.6-sol-max`、`claude-fable-5-thinking-max`、`claude-opus-5-thinking-xhigh`）。

Do not send `model` unless that pair was detected live. Missing overlay inherits the parent. Do not invent Cursor panel slugs.

**effort.** 只提供该路由 `resolveModelInfo().reasoning.efforts` 列出的 id。没有 effort 字段就省略。skill 从不在 spawn 上发送 `reasoning_effort` 或 `thinking`。官方 `subagent` schema 没有这些字段。角色 effort 写在 overlay 里，spawn 时放进 child `agentOptions.reasoningEffort`，不经 `agent/request` 改路由。

Effort is only the ids that route actually accepts. If the route has none, omit it. Skills never send `reasoning_effort` or `thinking` on spawn. Official `subagent` has no such field. Role effort lives in the overlay and is placed on the child `agentOptions.reasoningEffort` before the first request. `agent/request` does not change the route.

**设置 / Settings.** 配置页是官方 Settings 里的 `settings.section`（id `pstack`，order 16）。只列出已登录路由；effort 只列出该路由 live `resolveModelInfo().reasoning.efforts`。空列表就是继承父对话。保存写同一份 overlay，不是第二份配置。

The editor is the official Settings `settings.section` (id `pstack`, order 16). It lists logged-in routes only. Effort options are that route's live `resolveModelInfo().reasoning.efforts`. An empty list means inherit the parent. Save writes the same overlay, not a second file.

设置页只列出已经登录的 API key 路由，以及 dsh-oauth-login / dsh-antigravity-oauth 里已经签过名、并且适配器已注册的路由。空目录就是继承父对话。

## 推荐依赖 / Recommended peer

订阅与服务登录（ChatGPT / Claude / Grok / Copilot / OpenRouter / Kimi / Google Antigravity）要出现在 **设置 → pstack** 列表里，可按需安装 [dsh-oauth-login](https://github.com/aa2246740/dsh-oauth-login) 或 dsh-antigravity-oauth。不是硬依赖。只用 API key 的用户可以不装。本插件不读写 `~/.pi`、`~/.codex`、`~/.claude`、grok CLI 登录文件。

Subscription logins show up on **Settings → pstack** after you install [dsh-oauth-login](https://github.com/aa2246740/dsh-oauth-login) or dsh-antigravity-oauth. They are not required. API-key-only users work without them. This plugin does not read or write official CLI auth files.

```sh
dsh plugin --profile web add github:aa2246740/dsh-oauth-login#v0.2.7
```

## 这不是 Cursor 插件 / Not the Cursor plugin

这里的角色映射在 **设置 → pstack**。官方 Cursor `/setup-pstack` 会写 `~/.cursor/rules`，并用 Cursor 的模型名。不要在 DSH 上跑那份。

Role mapping in this repo is **Settings → pstack**. Official Cursor `/setup-pstack` writes `~/.cursor/rules` and uses Cursor slugs. Do not run it here.

## 工具 / Tools

本插件注册：

This plugin registers:

| 工具 / Tool | 作用 / Role |
|---|---|
| `pstack_spawn` | 按角色起 DSH 子 agent。不要传 model / effort。 |
| `pstack_catalog` | 只列出已登录的 live 路由。 |
| `pstack_overlay_read` / `pstack_overlay_write` | 读写 `$DSH_HOME/pstack-dsh.json`。 |
| Settings → pstack | 官方设置页。保存同一份 overlay。 |

技能入口：`/poteto-mode`，以及 bundled 的 playbook / principle skills。[`/setup-pstack`](./skills/setup-pstack/SKILL.md) 指向设置页。

Slash entry: `/poteto-mode`, plus the bundled playbook and principle skills. [`/setup-pstack`](./skills/setup-pstack/SKILL.md) points at the Settings page.

## 开发 / Develop

```sh
pnpm install
pnpm test
```

不要对用户正在用的 DSH Host 发 `--force`，也不要杀它。对照 [TEST-PLAN.md](./TEST-PLAN.md)。

Do not `--force` or kill a user's live DSH Host. See [TEST-PLAN.md](./TEST-PLAN.md).

## 许可 / License

MIT。玩法与原则：Lauren Tan。DSH 移植打包：aa2246740。Fork 维护：ukewea。见 [LICENSE](./LICENSE)。

MIT. Playbooks and principles: Lauren Tan. DSH port packaging: aa2246740. Fork maintenance: ukewea. See [LICENSE](./LICENSE).

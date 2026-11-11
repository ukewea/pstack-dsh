# pstack 0.15 text port

> Superseded for invocation (2026-11-12): the DSH port now follows upstream pstack 0.15.36 (`de8ee15`). Only `setup-pstack` is model-invocable; every other skill keeps `disable-model-invocation: true`, and poteto-mode reads bundled skills by path (`../<name>/SKILL.md` from its base directory). The "Model invocation for all `principle-*` skills" line and the "Cursor-only invocation restrictions" exclusion below describe the earlier 0.15.0 port.

## Provenance

This DSH candidate ports Markdown changes from upstream `cursor/plugins`, `pstack/`, at `71ed0d1076fec562c1b74ee353121a8d00f75382`, version 0.15.0.

The comparison base is `bdf7aa355337897f167153e05069aca505dae17c`, upstream 0.14.3. It is a reconstructed content baseline, not a proven common Git ancestor. The research compared DSH commit `193e9e5e4b887da4d5cb1e5acaee7f8e9bc4d44b`. The actual installed source is commit `d95efa39760b8d4691dff37dc68e75ebafffd463` plus local changes captured in `installed-before.tar.gz`. This upgrade preserves those local changes.

Each text change was compared against both upstream versions and the candidate's DSH adaptation. The main upstream changes are density in `e8d856f`, punctuation in `d7cde2b`, and release counts in `71ed0d1`. The final autopilot chooser remains. This is a DSH port version, not a claim that the DSH package itself is upstream 0.15.0.

## Included

- Shorter skill instructions and shared reference templates instead of repeated examples and output formats.
- An explanation-only `how` flow. Narrow questions use one explainer. Complex questions use explorers followed by an explainer. The critique branch and its two reference files are removed.
- `why` retains parallel coverage of all available evidence categories, explicit gaps, cited synthesis, and confidence language.
- Attack the Premise and Test Behavior, Not Implementation. The index now lists 23 principles and 23 playbooks.
- Model invocation for all `principle-*` skills. `how`, `why`, `unslop`, and `typescript-best-practices` remain callable by the model.
- Forge-neutral PR guidance where the DSH tools and included scripts support it.

## DSH choices preserved

`pstack_spawn` still receives role keys, not Cursor model slugs or `Task` fields. The DSH overlay selects logged-in routes and reasoning effort. Missing configuration still inherits the parent. This text port does not select models or modify user configuration.

The locally customized setup instructions and catalog remain. Only the retired how-critic invocation entries are removed from the spawn reference. Handling the old configuration key belongs to the runtime compatibility change, not to these Markdown instructions.

Long-running work follows the available DSH goal tools and their authorization rules. These docs do not install or promise a Cursor scheduler, cloud-sleeper, or a second Host.

## Excluded

`make-bot-ui`, Cursor-only invocation restrictions, Cursor cloud/runtime fields, model defaults, logo changes, and Harness core changes are not part of this text port. No installed source or runtime is edited by the Markdown migration.

## Verification boundary

Static checks cover principle counts and invocation frontmatter, retired how references, DSH role call sites, and local Markdown links. Build, package tests, runtime role compatibility, promotion, and browser acceptance belong to the parent upgrade process. Passing a text check does not prove live skill behavior or lower task cost. Upstream static token reductions do not establish DSH billing savings.

## Text change manifest

Paths below are relative to this candidate root. There are 100 added or modified Markdown files, including this record and the parent README update, and two deletions.

```text
HARNESS.md
README.md
UPGRADE-0.15.md
docs/guide/01-setup.md
docs/guide/02-poteto-mode.md
docs/guide/03-understand.md
docs/guide/06-verify-and-ship.md
docs/guide/07-overnight.md
docs/guide/08-principles.md
docs/guide/README.md
skills/architect/SKILL.md
skills/architect/references/rationale-template.md
skills/architect/references/runner-prompt.md
skills/arena/SKILL.md
skills/automate-me/SKILL.md
skills/blast-radius/SKILL.md
skills/figure-it-out/SKILL.md
skills/how/SKILL.md
skills/how/references/explainer-prompt.md
skills/how/references/explorer-prompt.md
skills/interrogate/SKILL.md
skills/interrogate/references/code-quality-review.md
skills/interrogate/references/lead-judgment.md
skills/interrogate/references/rubric.md
skills/no-comments/SKILL.md
skills/poteto-mode/SKILL.md
skills/poteto-mode/playbooks/authoring-a-skill.md
skills/poteto-mode/playbooks/autonomous-run.md
skills/poteto-mode/playbooks/autopilot-full.md
skills/poteto-mode/playbooks/autopilot-stack.md
skills/poteto-mode/playbooks/babysit.md
skills/poteto-mode/playbooks/bug-fix.md
skills/poteto-mode/playbooks/eval.md
skills/poteto-mode/playbooks/feature.md
skills/poteto-mode/playbooks/hillclimb.md
skills/poteto-mode/playbooks/investigation.md
skills/poteto-mode/playbooks/multi-phase-plan.md
skills/poteto-mode/playbooks/opening-a-pr.md
skills/poteto-mode/playbooks/orchestrate.md
skills/poteto-mode/playbooks/pause-safely.md
skills/poteto-mode/playbooks/perf-issue.md
skills/poteto-mode/playbooks/prototype.md
skills/poteto-mode/playbooks/refactoring.md
skills/poteto-mode/playbooks/runtime-forensics.md
skills/poteto-mode/playbooks/session-pickup.md
skills/poteto-mode/playbooks/shipping.md
skills/poteto-mode/playbooks/trace-forensics.md
skills/poteto-mode/playbooks/visual-parity.md
skills/poteto-mode/playbooks/worktree-cleanup.md
skills/poteto-mode/references/bugbot-triage.md
skills/principle-attack-the-premise/SKILL.md
skills/principle-boundary-discipline/SKILL.md
skills/principle-build-the-lever/SKILL.md
skills/principle-encode-lessons-in-structure/SKILL.md
skills/principle-exhaust-the-design-space/SKILL.md
skills/principle-experience-first/SKILL.md
skills/principle-fix-root-causes/SKILL.md
skills/principle-foundational-thinking/SKILL.md
skills/principle-guard-the-context-window/SKILL.md
skills/principle-laziness-protocol/SKILL.md
skills/principle-make-operations-idempotent/SKILL.md
skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md
skills/principle-minimize-reader-load/SKILL.md
skills/principle-model-the-domain/SKILL.md
skills/principle-never-block-on-the-human/SKILL.md
skills/principle-outcome-oriented-execution/SKILL.md
skills/principle-prove-it-works/SKILL.md
skills/principle-redesign-from-first-principles/SKILL.md
skills/principle-separate-before-serializing-shared-state/SKILL.md
skills/principle-sequence-verifiable-units/SKILL.md
skills/principle-subtract-before-you-add/SKILL.md
skills/principle-test-behavior-not-implementation/SKILL.md
skills/principle-type-system-discipline/SKILL.md
skills/recall/SKILL.md
skills/reflect/SKILL.md
skills/reflect/references/divergent-reviewer.md
skills/reflect/references/judgment-reviewer.md
skills/reflect/references/synthesizer.md
skills/reflect/references/tooling-reviewer.md
skills/setup-pstack/references/spawn.md
skills/show-me-your-work/SKILL.md
skills/swarm/SKILL.md
skills/tdd/SKILL.md
skills/teach/SKILL.md
skills/technical-writing/SKILL.md
skills/typescript-best-practices/SKILL.md
skills/typescript-best-practices/references/patterns.md
skills/unslop/SKILL.md
skills/why/SKILL.md
skills/why/references/epistemics.md
skills/why/references/investigator-prompt.md
skills/why/references/source-playbook.md
skills/why/references/sources/databricks.md
skills/why/references/sources/datadog.md
skills/why/references/sources/incident-postmortem.md
skills/why/references/sources/linear.md
skills/why/references/sources/notion.md
skills/why/references/sources/sentry.md
skills/why/references/sources/slack.md
skills/why/references/synthesizer-prompt.md
```

Deleted:

```text
skills/how/references/critic-prompt.md
skills/how/references/critique-rubric.md
```

# Test plan

Cola does not have to be the guinea pig. Run these against a local DSH checkout plus dshx.

## Static

```bash
npm install
npm test
npm run typecheck
```

`tests/static-call-sites.spec.ts` greps skills and docs for harness leftovers:

- Cursor `AskQuestion`, `TodoWrite`, `~/.cursor/rules`
- Cursor panel slugs (`claude-fable-5-thinking-max`, `gpt-5.6-sol-max`, `grok-4.6-fast-xhigh`, `claude-opus-5-thinking-xhigh`)
- `subagent_type`, grok `get_task_output`, grok `scheduler_create`
- spawn docs sending `reasoning_effort` / `thinking`
- `cursor-team-kit`, `/deslop` as a required control skill

## dshx check

From a machine with [dshx](https://github.com/aa2246740/dsh-external-plugin-devkit) and a DSH checkout:

```bash
dshx setup --harness /path/to/deepseek-harness
# link this repo as my-plugins/pstack-dsh if it is not already
dshx check pstack-dsh --harness /path/to/deepseek-harness
```

Must pass: named `export function apply`, no `export default`, boot marker `[my-plugins/pstack-dsh] loaded` in source, portable `cordis.yml`, `dsh.client` + lazy-CJS `lib/client.js` (`window.__ModuleLoader__.load`).

## verify-boot (isolated cold boot)

```bash
dshx status          # if a live Host is already supervised, skip this section
dshx verify-boot pstack-dsh --port 43123
```

Never `--force`. Never stop a Host this command did not start.

This cloud checkout ran `dshx check` green. `dshx verify-boot pstack-dsh --port 43123` then skipped isolated cold boot: the linked official DSH tree had no installed CLI (`dump-config exited 1`, `id pstack-dsh missing from dump-config`). No Host was started or stopped. Re-run verify-boot on a machine where `dsh` dumps config.

## Catalog / overlay (no network models required)

`tests/catalog.spec.ts` and `tests/overlay.spec.ts` cover:

- empty host → `selectableCount === 0`, `inheritParent: true`, oauth recommend line
- API-key route only when `credentials.describe` says configured
- unsigned vendor ids are not listed
- overlay write rejects a route that is not selectable
- overlay write rejects `reasoningEffort` when that route has no efforts
- overlay write rejects an effort id the live adapter did not list
- missing overlay file → every role inherits
- Settings snapshot/save uses the same overlay path and rejects unsigned slugs (`tests/settings-api.spec.ts`, `tests/settings-draft.spec.ts`)

## Manual Settings (EDITH / local DSH Web)

After the bundle has been activated on the intended Host (initial bundle installation requires an authorized Host restart):

1. Open Settings (sidebar gear) → **pstack** / **pstack 角色**.
2. With no keys and no oauth store: inherit-only, oauth recommend line, Save still writes inherit overlay.
3. Add `DEEPSEEK_API_KEY` or sign in through dsh-oauth-login. The role selector updates from Host notifications, without a page reload. Effort options match `resolveModelInfo` or are omitted.
4. Save. `$DSH_HOME/pstack-dsh.json` matches the form. `pstack_spawn` does not grow `model` / `reasoning_effort` fields.
5. `/setup-pstack` only points at Settings → pstack. It does not run a TUI picker.
6. Leave role/effort edits unsaved, then refresh models or receive a login/logout notification. Choices update; drafts and Save's dirty state remain. A selected route that disappears is marked unavailable rather than silently displaying inherit.

`node tests/settings-refresh.browser.mjs [candidate/lib/client.js]` checks these UI behaviors on the existing `127.0.0.1:43127` Host using the globally pinned Playwright runtime. Snapshot responses and Host notifications are simulated only in that test page; no login, saved overlay or server process is changed. Supplying a candidate bundle tests it before live publication.

## Build

`lib/` is committed, so installing pstack never builds it. Rebuild `lib/` after changing `src/`, and commit it with the source change.

The build uses the official DSH client preset `packages/client/tsdown.client.ts` and the `tsdown` installed with it. That preset is not published to npm, so it comes from a deepseek-harness git checkout at the tag this package targets (the preset stamps the checkout's commit, so a source tarball does not work):

```sh
git clone --depth 1 --branch dsh-v0.2.2-rc.1 https://github.com/deepseek-ai/deepseek-harness.git ~/dev/deepseek-harness
cd ~/dev/deepseek-harness && pnpm install --frozen-lockfile --filter @deepseek-ai/dsh-root --ignore-scripts
cd - && DSH_SOURCE=~/dev/deepseek-harness npm run build
```

The build script is POSIX shell. dshx is not needed to build.

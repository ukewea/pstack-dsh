import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

// Shipped content must not lean on Cursor's local state or on DSH internals the
// model cannot reach. Upstream syncs bring both back, so every rule lists its
// accepted exceptions with a reason, and a new hit fails until someone decides.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// Built from parts so this file does not itself contain the name the company mirror scans for.
const BUN_SPAWN = new RegExp(['\\bBun', '__will_be_noop_run__(Sync)?\\b'].join('\\.'))
const BUN_SPAWN_FILE = 'skills/poteto-mode/scripts/bootstrap.ts'
const SCANNED_DIRS = ['skills', 'agents', 'docs']
const SCANNED_FILES = ['README.md', 'HARNESS.md']
const TEXT = /\.(md|ts|mts|mjs|js|cjs|sh|json)$|\/watch-pr$|\/statechart$/
// statechart's own test fixtures are not shipped (package.json files excludes them).
const SKIP = [/^skills\/statechart\/scripts\/test\//, /\/node_modules\//]

interface Rule {
  readonly id: string
  readonly re: RegExp
  readonly scope?: RegExp
  /** path → why this occurrence is acceptable */
  readonly allow?: Readonly<Record<string, string>>
  /** Skip the stale-exception check (a branch may legitimately remove the hit). */
  readonly allowMayVanish?: boolean
}

const RULES: readonly Rule[] = [
  {
    id: 'Cursor local state path',
    re: /~\/\.cursor\b|\$HOME\/\.cursor\b|\.cursor\/(projects|rules|plugins|skills)\b/,
    allow: {
      'README.md': 'warns not to run Cursor setup that writes ~/.cursor/rules',
      'HARNESS.md': 'mapping table row marking ~/.cursor/rules Cursor-only',
      'skills/setup-pstack/SKILL.md': 'tells the model not to write ~/.cursor/rules',
    },
  },
  {
    id: 'Cursor-only tool or command',
    re: /Origin CLI|\/in-cloud\b|Cursor's built-in|\*\*create-skill\*\*|\/visualize\b/,
  },
  {
    id: 'Cursor environment variable',
    re: /\bCURSOR_[A-Z_]+\b/,
    allow: {
      'skills/poteto-mode/scripts/watch-pr/github.ts': 'recognises Cursor Bugbot comments on GitHub PRs, not local Cursor state',
      'skills/poteto-mode/scripts/watch-pr/github.test.ts': 'fixture for the Bugbot comment marker',
    },
  },
  {
    id: 'DSH private API',
    re: /SessionPersistence|\.locate\(/,
  },
  {
    id: 'Host ctx API in model-facing text',
    re: /\bctx\.[a-zA-Z]+/,
    scope: /^(skills|agents)\/.*\.md$/,
    allow: {
      'skills/setup-pstack/references/catalog.md': "documents pstack's own route-selection rule, not a call for the model",
    },
  },
  {
    id: 'Bun spawn API (oops replaces every one for the company mirror)',
    re: BUN_SPAWN,
    allow: {
      'skills/poteto-mode/scripts/bootstrap.ts': 'installs and re-execs the poteto-mode tools; oops swaps it for a no-op',
    },
    // On the oops branch bootstrap.ts holds none at all.
    allowMayVanish: true,
  },
  {
    id: 'other subprocess API (report to the company mirror before adding)',
    re: /node:__will_be_noop_subprocess__|from ['"]__will_be_noop_subprocess__['"]|\bBun\.\$|\bexeca\b/,
    allow: {
      'skills/poteto-mode/scripts/watch-pr/github.ts': 'read-only git and gh calls for babysit',
      'skills/poteto-mode/scripts/watch-pr/github.test.ts': 'runs the CLI against a fake gh',
      'skills/poteto-mode/scripts/check-plan.test.ts': 'runs check-plan.mjs on a fixture',
      'skills/statechart/scripts/run.ts': 'runs TLC (java) and mise',
      'skills/statechart/scripts/statechart.ts': 'runs the statechart worker',
    },
  },
]

async function shippedFiles(): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      const rel = relative(ROOT, path)
      if (SKIP.some(re => re.test(rel))) continue
      if (entry.isDirectory()) await walk(path)
      else if (TEXT.test(rel)) out.push(rel)
    }
  }
  for (const dir of SCANNED_DIRS) await walk(join(ROOT, dir))
  return [...out, ...SCANNED_FILES].sort()
}

describe('harness boundaries in shipped content', () => {
  for (const rule of RULES) {
    it(`has no unreviewed ${rule.id}`, async () => {
      const hits: string[] = []
      const seen = new Set<string>()
      for (const rel of await shippedFiles()) {
        if (rule.scope !== undefined && !rule.scope.test(rel)) continue
        const lines = (await readFile(join(ROOT, rel), 'utf8')).split('\n')
        lines.forEach((line, index) => {
          if (!rule.re.test(line)) return
          seen.add(rel)
          if (rule.allow?.[rel] === undefined) hits.push(`${rel}:${index + 1}: ${line.trim().slice(0, 120)}`)
        })
      }
      assert.deepEqual(hits, [], `${rule.id}: fix these, or add the file to the rule's allow list with a reason`)
      // A stale exception hides the next regression in that file; drop it once fixed.
      const stale = rule.allowMayVanish === true ? [] : Object.keys(rule.allow ?? {}).filter(path => !seen.has(path))
      assert.deepEqual(stale, [], `${rule.id}: allow-list entries that no longer match`)
    })
  }

  it('names Bun spawn APIs in no repo file but bootstrap.ts, docs and tests included', async () => {
    // oops must hold zero matches anywhere, and a mention in a doc or test counts.
    const hits: string[] = []
    async function walk(dir: string): Promise<void> {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (['node_modules', '.git', 'lib'].includes(entry.name)) continue
        const path = join(dir, entry.name)
        const rel = relative(ROOT, path)
        if (entry.isDirectory()) await walk(path)
        else if (/\.(md|ts|mts|mjs|js|cjs|sh|json|ya?ml)$/.test(rel) && rel !== BUN_SPAWN_FILE
          && BUN_SPAWN.test(await readFile(path, 'utf8'))) hits.push(rel)
      }
    }
    await walk(ROOT)
    assert.deepEqual(hits, [])
  })
})

import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  parseOverlay,
  readOverlay,
  validateOverlayAgainstCatalog,
  writeOverlay,
} from '../src/overlay.ts'
import type { LiveRoute } from '../src/catalog-types.ts'

const live: LiveRoute[] = [
  {
    provider: 'deepseek-official',
    providerName: 'DeepSeek',
    model: 'deepseek-chat',
    modelName: 'DeepSeek Chat',
    selectable: true,
    source: 'api-key',
    routeRegistered: true,
    efforts: [{ id: 'high', name: 'High' }],
  },
  {
    provider: 'pi-anthropic',
    providerName: 'Claude',
    model: 'claude-sonnet-4-6',
    modelName: 'Sonnet',
    selectable: true,
    source: 'oauth',
    routeRegistered: true,
    efforts: [],
  },
]

describe('overlay', () => {
  it('treats a missing file as inherit for every role', async () => {
    const home = await mkdtemp(join(tmpdir(), 'pstack-dsh-overlay-missing-'))
    const current = await readOverlay(home)
    assert.equal(current.missing, true)
    assert.equal(current.overlay.roles.feature?.inherit, true)
    assert.deepEqual(current.overlay.roles.feature?.routes, [])
  })

  it('parses inherit-parent aliases and rejects extra fields', () => {
    const overlay = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        feature: { inherit: 'auto', routes: [] },
      },
    }))
    assert.equal(overlay.roles.feature?.inherit, true)
    assert.throws(() => parseOverlay(JSON.stringify({
      version: 1,
      roles: { feature: { inherit: false, routes: [{ provider: 'x', model: 'y', extra: true }] } },
    })))
    assert.throws(() => parseOverlay(JSON.stringify({
      version: 1,
      roles: { 'not-a-role': { inherit: true, routes: [] } },
    })))
  })

  it('rejects a scalar role with two routes', () => {
    assert.throws(() => parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        feature: {
          inherit: false,
          routes: [
            { provider: 'deepseek-official', model: 'deepseek-chat' },
            { provider: 'pi-anthropic', model: 'claude-sonnet-4-6' },
          ],
        },
      },
    })))
  })

  it('validates routes and efforts against the live catalog', () => {
    const good = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        feature: {
          inherit: false,
          routes: [{ provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'high' }],
        },
      },
    }))
    assert.deepEqual(validateOverlayAgainstCatalog(good, live), [])

    const unsigned = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        feature: {
          inherit: false,
          routes: [{ provider: 'openai', model: 'gpt-4' }],
        },
      },
    }))
    assert.match(validateOverlayAgainstCatalog(unsigned, live).join('\n'), /not a logged-in live route/)

    const noEffort = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        'judgment-and-prose': {
          inherit: false,
          routes: [{ provider: 'pi-anthropic', model: 'claude-sonnet-4-6', reasoningEffort: 'xhigh' }],
        },
      },
    }))
    assert.match(validateOverlayAgainstCatalog(noEffort, live).join('\n'), /has no effort field/)

    // A role retired upstream keeps its saved value but is no longer checked.
    const retired = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        'why-synthesizer': {
          inherit: false,
          routes: [{ provider: 'pi-anthropic', model: 'claude-sonnet-4-6', reasoningEffort: 'xhigh' }],
        },
      },
    }))
    assert.deepEqual(validateOverlayAgainstCatalog(retired, live), [])
    assert.equal(retired.roles['why-synthesizer']?.inherit, false)

    const wrongEffort = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        feature: {
          inherit: false,
          routes: [{ provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'max' }],
        },
      },
    }))
    assert.match(validateOverlayAgainstCatalog(wrongEffort, live).join('\n'), /not accepted/)
  })

  it('ignores stale critics routes and effort without exempting active roles', () => {
    const critics = {
      inherit: false,
      routes: [
        { provider: 'retired-provider', model: 'retired-model', reasoningEffort: 'legacy-max' },
        { provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'obsolete' },
        { provider: 'pi-anthropic', model: 'claude-sonnet-4-6', reasoningEffort: 'xhigh' },
      ],
    }
    const overlay = parseOverlay(JSON.stringify({ version: 1, roles: { 'how-critics': critics } }))
    const original = structuredClone(overlay)
    assert.deepEqual(validateOverlayAgainstCatalog(overlay, live), [])
    assert.deepEqual(validateOverlayAgainstCatalog(overlay, []), [])
    assert.deepEqual(overlay, original)
    overlay.roles['arena-runners'] = critics
    const errors = validateOverlayAgainstCatalog(overlay, live)
    assert.equal(errors.length, 3)
    assert.ok(errors.every(error => error.startsWith('arena-runners[')))
  })

  it('accepts the legacy role but rejects unknown keys at every overlay level', () => {
    const critics = { inherit: false, routes: [{ provider: 'old', model: 'old', reasoningEffort: 'max' }] }
    assert.deepEqual(parseOverlay(JSON.stringify({ version: 1, roles: { 'how-critics': critics } })).roles['how-critics'], critics)
    const invalid = [
      { version: 1, roles: { 'how-critics': critics }, extra: true },
      { version: 1, roles: { 'how-critics': critics, 'how-critics-new': critics } },
      { version: 1, roles: { 'how-critics': { ...critics, extra: true } } },
      { version: 1, roles: { 'how-critics': { ...critics, routes: [{ ...critics.routes[0], extra: true }] } } },
    ]
    for (const value of invalid) {
      assert.throws(() => parseOverlay(JSON.stringify(value)), /unknown/)
    }
  })

  it('round-trips a write', async () => {
    const home = await mkdtemp(join(tmpdir(), 'pstack-dsh-overlay-write-'))
    const overlay = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        feature: {
          inherit: false,
          routes: [{ provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'high' }],
        },
      },
    }))
    const path = await writeOverlay(overlay, home)
    const current = await readOverlay(home)
    assert.equal(current.missing, false)
    assert.equal(current.path, path)
    assert.equal(current.overlay.roles.feature?.inherit, false)
    assert.equal(current.overlay.roles.feature?.routes[0]?.reasoningEffort, 'high')
  })

  it('keeps the previous overlay intact when the atomic replacement cannot start', async () => {
    const home = await mkdtemp(join(tmpdir(), 'pstack-dsh-overlay-failure-'))
    const path = join(home, 'pstack-dsh.json')
    const original = '{"version":1,"roles":{}}\n'
    const replacement = parseOverlay(JSON.stringify({
      version: 1,
      roles: { feature: { inherit: false, routes: [{ provider: 'deepseek-official', model: 'deepseek-chat' }] } },
    }))
    await writeFile(path, original, { mode: 0o600 })
    await chmod(home, 0o500)
    try {
      await assert.rejects(() => writeOverlay(replacement, home))
      assert.equal(await readFile(path, 'utf8'), original)
    } finally {
      await chmod(home, 0o700)
    }
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MessageId } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { emptyOverlay, parseOverlay } from '../src/overlay.ts'
import { spawnTool, type SpawnSubagents } from '../src/tools.ts'
import { normalizeRole } from '../src/roles.ts'
import { resolveSpawn } from '../src/spawn.ts'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('resolveSpawn', () => {
  it('inherits when the overlay is missing a mapping', () => {
    const resolved = resolveSpawn(emptyOverlay(), {
      role: 'feature',
      description: 'build flag',
      prompt: 'add --json',
      runInBackground: true,
    })
    assert.equal(resolved.inherit, true)
    assert.equal(resolved.agentOptions, undefined)
  })

  it('maps a logged-in route without putting effort on the spawn schema', () => {
    const overlay = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        feature: {
          inherit: false,
          routes: [{ provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'high' }],
        },
      },
    }))
    const resolved = resolveSpawn(overlay, {
      role: 'generalPurpose',
      description: 'ad hoc',
      prompt: 'help',
      runInBackground: true,
    })
    assert.equal(normalizeRole('generalPurpose'), 'poteto-agent')
    assert.equal(resolved.role, 'poteto-agent')
    assert.equal(resolved.inherit, true)

    const feature = resolveSpawn(overlay, {
      role: 'feature',
      description: 'build flag',
      prompt: 'add --json',
      runInBackground: true,
    })
    assert.equal(feature.inherit, false)
    assert.deepEqual(feature.agentOptions, {
      provider: 'deepseek-official',
      model: 'deepseek-chat',
      reasoningEffort: 'high',
    })
  })

  it('rejects a route index that is not in the overlay list', () => {
    const overlay = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        feature: {
          inherit: false,
          routes: [{ provider: 'deepseek-official', model: 'deepseek-chat' }],
        },
      },
    }))
    assert.throws(() => resolveSpawn(overlay, {
      role: 'feature',
      description: 'build flag',
      prompt: 'add --json',
      runInBackground: true,
      routeIndex: 3,
    }), /route_index/)
  })
})

describe('retired how-critics spawn', () => {
  for (const continuable of [false, true]) {
    for (const background of [undefined, false, true]) {
      it(`starts zero agents with continuable=${continuable}, background=${background}`, async () => {
        let starts = 0
        const subagents: SpawnSubagents = {
          async startActivation() {
            starts += 1
            return {
              childId: SessionId('unexpected-child'),
              messageId: MessageId('unexpected-message'),
              result: Promise.resolve({ output: [], stopReason: 'completed' }),
              async dispose() {},
            }
          },
          getProvider() {
            return continuable
              ? { name: 'spawn', capabilities: { agentPreset: true, agentOptions: true, outputSchema: false, depthLimit: true }, inheritsParentContext: false }
              : { name: 'spawn', capabilities: { agentPreset: false, agentOptions: false, outputSchema: false, depthLimit: false }, inheritsParentContext: false }
          },
          resolveMaxDepth() { return undefined },
        }
        const tool = spawnTool({ subagents })
        const result = await tool.execute({
          role: 'how-critics',
          description: 'Legacy critic request',
          prompt: 'Review this design',
          ...(background === undefined ? {} : { run_in_background: background }),
          route_index: 1,
        }, { agent: { id: SessionId('parent') } as unknown as Agent })
        assert.deepEqual(result, {
          kind: 'disabled',
          role: 'how-critics',
          reason: 'how-critics was retired in pstack 0.15; no agent was started.',
        })
        assert.equal(starts, 0)
      })
    }
  }
})

describe('activation spec shape', () => {
  // DSH 0.2.2-rc.1 reads the task from spec.request. 0.2.2-rc.2 reads the same
  // fields from the spec itself and fails on spec.parent.id without them.
  it('puts the task both on the spec and under request', async () => {
    const specs: Record<string, unknown>[] = []
    const subagents: SpawnSubagents = {
      async startActivation(spec) {
        specs.push(spec as unknown as Record<string, unknown>)
        return {
          childId: SessionId('child-shape'),
          messageId: MessageId('message-shape'),
          result: Promise.resolve({ output: [], stopReason: 'completed' }),
          async dispose() {},
        }
      },
      getProvider() {
        return { name: 'spawn', capabilities: { agentPreset: true, agentOptions: true, outputSchema: false, depthLimit: true }, inheritsParentContext: false }
      },
      resolveMaxDepth() { return 2 },
    }
    const home = await mkdtemp(join(tmpdir(), 'pstack-shape-'))
    const parent = { id: SessionId('parent-shape') } as unknown as Agent
    await spawnTool({ subagents, dshHome: home, env: { DSH_HOME: home } }).execute({
      role: 'feature',
      description: 'shape check',
      prompt: 'add json',
      cwd: '/tmp/shape',
    }, { agent: parent, signal: new AbortController().signal })
    const spec = specs[0]
    assert.ok(spec !== undefined)
    const nested = spec.request as Record<string, unknown>
    for (const view of [spec, nested]) {
      assert.equal(view.parent, parent)
      assert.equal(view.cwd, '/tmp/shape')
      assert.equal(view.agentPreset, 'pstack-poteto')
      assert.equal(view.maxDepth, 2)
      assert.match(JSON.stringify(view.prompt), /add json/)
    }
    assert.equal(spec.delivery, 'parent')
  })
})

import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { Context, Service } from '@deepseek-ai/cordis'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { ResolvedSubagentStartRequest, SubagentResult } from '@deepseek-ai/dsh-subagent'
import { defaultSkillsRoot } from '../src/skills-provider.ts'
import { spawnTool } from '../src/tools.ts'

function llmFor(efforts: { id: string; name: string }[]) {
  return {
    listProviders: () => [{ id: 'deepseek-official', name: 'DeepSeek' }],
    async listModels() {
      return [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }]
    },
    async resolveModelInfo() {
      return { id: 'deepseek-chat', name: 'DeepSeek Chat', reasoning: { efforts } }
    },
  }
}

class Agents extends Service {
  static provide = 'agents'
  readonly parents = new Map<string, Parent>()
  constructor(ctx: Context) { super(ctx, 'agents') }
  get(id: string) { return this.parents.get(id) }
}

class WorkingDirectory extends Service {
  static provide = 'workingDirectory'
  constructor(ctx: Context) { super(ctx, 'workingDirectory') }
  async ensure() { return '/tmp/pstack-contract-cwd' }
}

class SessionPersistence extends Service {
  static provide = 'sessionPersistence'
  constructor(ctx: Context) { super(ctx, 'sessionPersistence') }
}

function isRolePreset(value: unknown): value is {
  apply: (
    ctx: { tools: { guard(guard: (execution: { name: string }) => string | undefined): void } },
    config?: { restrictWrites?: boolean },
  ) => void
} {
  return typeof value === 'object' && value !== null && 'apply' in value && typeof value.apply === 'function'
}

interface Notice {
  via: string
  kind?: string
  sender?: string
}

interface Parent {
  id: string
  status: string
  options: { subagentDepth?: number }
  ctx: Context
  session: {
    header: { id: string; delegationDepth: number; parentSession?: string }
    append: (type: string, data: unknown) => void
  }
  followup: (message: { source?: { kind?: string; senderSessionId?: string } }) => void
  steer: (message: unknown) => void
}

interface SeenRequest {
  provider?: string
  model?: string
  effort?: string
  cwd?: string
  prompt?: string
  agentPreset?: string
  maxDepth?: number
}

function agentOf(parent: Parent): Agent {
  return parent as unknown as Agent
}

function parentOf(ctx: Context, id: string, notices: Notice[], depth = 0): Parent {
  return {
    id,
    status: 'idle',
    options: { subagentDepth: depth },
    ctx,
    session: {
      header: { id, delegationDepth: depth },
      append() {},
    },
    followup(message) {
      notices.push({ via: 'followup', kind: message.source?.kind, sender: message.source?.senderSessionId })
    },
    steer() { notices.push({ via: 'steer' }) },
  }
}

async function openRuntime() {
  const ctx = new Context()
  const agents = new Agents(ctx)
  new WorkingDirectory(ctx)
  new SessionPersistence(ctx)
  const runtime = new SubagentRuntime(ctx, {
    maxDepth: { get: () => 1 },
    maxActiveSubagents: { get: () => 8 },
  })
  if (typeof runtime.startActivation !== 'function') {
    throw new Error('Installed @deepseek-ai/dsh-subagent has no startActivation. Use the DSH 0.2.2-rc.1 tree. This test does not skip.')
  }
  await Promise.resolve()
  return { ctx, agents, runtime }
}

function provider(name: string, capabilities: { agentPreset: boolean; agentOptions: boolean; depthLimit: boolean }, local: boolean, seen: SeenRequest[]) {
  const runs: { settle: () => void }[] = []
  const base = {
    name,
    capabilities: { ...capabilities, outputSchema: false },
    inheritsParentContext: false as const,
    runs,
  }
  if (local) return { ...base, async prepareContinuable() { return {} } }
  return {
    ...base,
    async start(request: ResolvedSubagentStartRequest) {
      const first = request.prompt[0]
      seen.push({
        provider: request.agentOptions?.provider,
        model: request.agentOptions?.model,
        effort: request.agentOptions?.reasoningEffort === undefined ? undefined : String(request.agentOptions.reasoningEffort),
        cwd: request.cwd,
        prompt: first !== undefined && first.type === 'text' ? first.text : undefined,
        agentPreset: request.agentPreset,
        maxDepth: request.maxDepth,
      })
      let settle = (_value: SubagentResult) => {}
      const result = new Promise<SubagentResult>(resolve => { settle = resolve })
      runs.push({
        settle: () => settle({
          output: [{ type: 'text', text: 'child-done' }],
          stopReason: 'completed',
        }),
      })
      return { id: SessionId(`child-${seen.length}`), result, async dispose() {} }
    },
  }
}

describe('pstack spawn on DSH 0.2.2 subagent runtime', () => {
  it('returns the runtime child id and notifies that parent once', async () => {
    const { ctx, agents, runtime } = await openRuntime()
    const notices: Notice[] = []
    const parent = parentOf(ctx, 'parent-a', notices)
    agents.parents.set(parent.id, parent)
    const seen: SeenRequest[] = []
    const registered = provider('spawn', { agentPreset: true, agentOptions: true, depthLimit: true }, false, seen)
    runtime.registerProvider(registered)
    const home = await mkdtemp(join(tmpdir(), 'pstack-contract-'))
    await writeFile(join(home, 'pstack-dsh.json'), JSON.stringify({
      version: 1,
      roles: { feature: { inherit: false, routes: [{ provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'high' }] } },
    }))
    const tool = spawnTool({
      subagents: runtime,
      dshHome: home,
      env: { DSH_HOME: home, DEEPSEEK_API_KEY: 'test-key' },
      llm: llmFor([{ id: 'high', name: 'High' }]),
    })
    const value = await tool.execute({
      description: 'build flag',
      prompt: 'add json',
      role: 'feature',
      run_in_background: true,
    }, { agent: agentOf(parent), signal: new AbortController().signal })
    assert.equal(value && typeof value === 'object' && 'kind' in value && value.kind, 'activation')
    assert.equal(seen[0]?.provider, 'deepseek-official')
    assert.equal(seen[0]?.model, 'deepseek-chat')
    assert.equal(seen[0]?.effort, 'high')
    assert.match(seen[0]?.prompt ?? '', /add json/)
    // poteto-agent reads poteto-mode from this absolute path and resolves leaf skills beside it.
    assert.ok((seen[0]?.prompt ?? '').includes(join(defaultSkillsRoot(), 'poteto-mode', 'SKILL.md')))
    const childId = value && typeof value === 'object' && 'subagentId' in value ? String(value.subagentId) : ''
    assert.equal(childId, 'child-1')
    registered.runs[0]?.settle()
    await new Promise(resolve => setTimeout(resolve, 30))
    const settled = notices.filter(notice => notice.kind === 'subagent-settled')
    assert.deepEqual(settled, [{ via: 'followup', kind: 'subagent-settled', sender: childId }])
  })

  it('does not leak one role route into the next child', async () => {
    const { ctx, agents, runtime } = await openRuntime()
    const parent = parentOf(ctx, 'parent-b', [])
    agents.parents.set(parent.id, parent)
    const seen: SeenRequest[] = []
    runtime.registerProvider(provider('spawn', { agentPreset: true, agentOptions: true, depthLimit: true }, false, seen))
    const home = await mkdtemp(join(tmpdir(), 'pstack-contract-routes-'))
    await writeFile(join(home, 'pstack-dsh.json'), JSON.stringify({
      version: 1,
      roles: {
        feature: { inherit: false, routes: [{ provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'high' }] },
        'bug-fix': { inherit: true, routes: [] },
      },
    }))
    const tool = spawnTool({
      subagents: runtime,
      dshHome: home,
      env: { DSH_HOME: home, DEEPSEEK_API_KEY: 'test-key' },
      llm: llmFor([{ id: 'high', name: 'High' }]),
    })
    await tool.execute({ description: 'one', prompt: 'first', role: 'feature' }, { agent: agentOf(parent), signal: new AbortController().signal })
    await tool.execute({ description: 'two', prompt: 'second', role: 'bug-fix' }, { agent: agentOf(parent), signal: new AbortController().signal })
    assert.equal(seen[0]?.model, 'deepseek-chat')
    assert.equal(seen[1]?.provider, undefined)
    assert.equal(seen[1]?.model, undefined)
  })

  it('refuses a route that the live catalog cannot select', async () => {
    const { ctx, agents, runtime } = await openRuntime()
    const parent = parentOf(ctx, 'parent-c', [])
    agents.parents.set(parent.id, parent)
    const seen: SeenRequest[] = []
    runtime.registerProvider(provider('spawn', { agentPreset: true, agentOptions: true, depthLimit: true }, false, seen))
    const home = await mkdtemp(join(tmpdir(), 'pstack-contract-auth-'))
    await writeFile(join(home, 'pstack-dsh.json'), JSON.stringify({
      version: 1,
      roles: { feature: { inherit: false, routes: [{ provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'max' }] } },
    }))
    const tool = spawnTool({
      subagents: runtime,
      dshHome: home,
      env: { DSH_HOME: home, DEEPSEEK_API_KEY: 'test-key' },
      llm: llmFor([{ id: 'high', name: 'High' }]),
    })
    await assert.rejects(() => tool.execute({
      description: 'nope',
      prompt: 'go',
      role: 'feature',
    }, { agent: agentOf(parent), signal: new AbortController().signal }), /does not list reasoning effort/)
    assert.equal(seen.length, 0)
  })

  it('refuses an explicit effort when the selectable route lists none', async () => {
    const { ctx, agents, runtime } = await openRuntime()
    const parent = parentOf(ctx, 'parent-empty-effort', [])
    agents.parents.set(parent.id, parent)
    const seen: SeenRequest[] = []
    runtime.registerProvider(provider('spawn', { agentPreset: true, agentOptions: true, depthLimit: true }, false, seen))
    const home = await mkdtemp(join(tmpdir(), 'pstack-contract-empty-effort-'))
    await writeFile(join(home, 'pstack-dsh.json'), JSON.stringify({
      version: 1,
      roles: { feature: { inherit: false, routes: [{ provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'high' }] } },
    }))
    const tool = spawnTool({
      subagents: runtime,
      dshHome: home,
      env: { DSH_HOME: home, DEEPSEEK_API_KEY: 'test-key' },
      llm: llmFor([]),
    })
    await assert.rejects(() => tool.execute({
      description: 'nope',
      prompt: 'go',
      role: 'feature',
    }, { agent: agentOf(parent), signal: new AbortController().signal }), /does not list reasoning effort/)
    assert.equal(seen.length, 0)
  })

  it('refuses comment-sicko when the provider cannot apply a preset', async () => {
    const { ctx, agents, runtime } = await openRuntime()
    const parent = parentOf(ctx, 'parent-d', [])
    agents.parents.set(parent.id, parent)
    const seen: SeenRequest[] = []
    runtime.registerProvider(provider('spawn', { agentPreset: false, agentOptions: true, depthLimit: true }, false, seen))
    const home = await mkdtemp(join(tmpdir(), 'pstack-contract-sicko-'))
    const tool = spawnTool({ subagents: runtime, dshHome: home, env: { DSH_HOME: home } })
    await assert.rejects(() => tool.execute({
      description: 'kill comments',
      prompt: 'review',
      role: 'comment-sicko',
    }, { agent: agentOf(parent), signal: new AbortController().signal }), /requires agent preset/)
    assert.equal(seen.length, 0)
  })

  it('sends the comment-sicko preset id when the provider can apply one', async () => {
    const { ctx, agents, runtime } = await openRuntime()
    const parent = parentOf(ctx, 'parent-e', [])
    agents.parents.set(parent.id, parent)
    const seen: SeenRequest[] = []
    runtime.registerProvider(provider('spawn', { agentPreset: true, agentOptions: true, depthLimit: true }, false, seen))
    const home = await mkdtemp(join(tmpdir(), 'pstack-contract-preset-'))
    const tool = spawnTool({ subagents: runtime, dshHome: home, env: { DSH_HOME: home } })
    await tool.execute({ description: 'kill comments', prompt: 'review', role: 'comment-sicko' }, { agent: agentOf(parent), signal: new AbortController().signal })
    assert.equal(seen[0]?.agentPreset, 'pstack-comment-sicko')
    assert.match(seen[0]?.prompt ?? '', /I hate comments/)
    assert.doesNotMatch(seen[0]?.prompt ?? '', /poteto-mode\/SKILL\.md/)
  })

  it('rejects a child that would pass the runtime depth cap', async () => {
    const { ctx, agents, runtime } = await openRuntime()
    const parent = parentOf(ctx, 'parent-deep', [], 1)
    agents.parents.set(parent.id, parent)
    runtime.registerProvider(provider('spawn', { agentPreset: true, agentOptions: true, depthLimit: true }, true, []))
    const home = await mkdtemp(join(tmpdir(), 'pstack-contract-depth-'))
    const tool = spawnTool({ subagents: runtime, dshHome: home, env: { DSH_HOME: home } })
    await assert.rejects(() => tool.execute({
      description: 'too deep',
      prompt: 'go',
      role: 'feature',
    }, { agent: agentOf(parent), signal: new AbortController().signal }), /exceeds maxDepth/)
  })

  it('gives parallel children the directories they were given', async () => {
    const { ctx, agents, runtime } = await openRuntime()
    const parent = parentOf(ctx, 'parent-cwd', [])
    agents.parents.set(parent.id, parent)
    const seen: SeenRequest[] = []
    runtime.registerProvider(provider('spawn', { agentPreset: true, agentOptions: true, depthLimit: true }, false, seen))
    const home = await mkdtemp(join(tmpdir(), 'pstack-contract-cwd-'))
    const tool = spawnTool({ subagents: runtime, dshHome: home, env: { DSH_HOME: home } })
    const first = join(home, 'tree-a')
    const second = join(home, 'tree-b')
    await Promise.all([
      tool.execute({ description: 'a', prompt: 'one', role: 'feature', cwd: first }, { agent: agentOf(parent), signal: new AbortController().signal }),
      tool.execute({ description: 'b', prompt: 'two', role: 'bug-fix', cwd: second }, { agent: agentOf(parent), signal: new AbortController().signal }),
    ])
    assert.deepEqual(seen.map(item => item.cwd).sort(), [first, second].sort())
  })

  it('waits in the tool when background is false and does not also notify the parent', async () => {
    const { ctx, agents, runtime } = await openRuntime()
    const notices: Notice[] = []
    const parent = parentOf(ctx, 'parent-fg', notices)
    agents.parents.set(parent.id, parent)
    const seen: SeenRequest[] = []
    const registered = provider('spawn', { agentPreset: true, agentOptions: true, depthLimit: true }, false, seen)
    runtime.registerProvider(registered)
    const home = await mkdtemp(join(tmpdir(), 'pstack-contract-fg-'))
    const tool = spawnTool({ subagents: runtime, dshHome: home, env: { DSH_HOME: home } })
    const pending = tool.execute({
      description: 'wait',
      prompt: 'now',
      role: 'feature',
      run_in_background: false,
    }, { agent: agentOf(parent), signal: new AbortController().signal })
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(notices.length, 0)
    registered.runs[0]?.settle()
    const value = await pending
    assert.equal(value && typeof value === 'object' && 'kind' in value && value.kind, 'foreground')
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(notices.filter(notice => notice.kind === 'subagent-settled').length, 0)
  })

  it('does not start a child when the caller already aborted', async () => {
    const { ctx, agents, runtime } = await openRuntime()
    const parent = parentOf(ctx, 'parent-abort', [])
    agents.parents.set(parent.id, parent)
    const seen: SeenRequest[] = []
    runtime.registerProvider(provider('spawn', { agentPreset: true, agentOptions: true, depthLimit: true }, false, seen))
    const home = await mkdtemp(join(tmpdir(), 'pstack-contract-abort-'))
    const tool = spawnTool({ subagents: runtime, dshHome: home, env: { DSH_HOME: home } })
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(() => tool.execute({
      description: 'stop',
      prompt: 'go',
      role: 'feature',
    }, { agent: agentOf(parent), signal: controller.signal }))
    assert.equal(seen.length, 0)
  })

  it('blocks write, edit, and bash through the comment-sicko tool guard', async () => {
    const loaded: unknown = await import(new URL('../presets/role.mjs', import.meta.url).href)
    if (!isRolePreset(loaded)) throw new Error('presets/role.mjs does not export apply')
    const guards: ((execution: { name: string }) => string | undefined)[] = []
    loaded.apply({
      tools: {
        guard(guard: (execution: { name: string }) => string | undefined) { guards.push(guard) },
      },
    }, { restrictWrites: true })
    const guard = guards[0]
    if (guard === undefined) throw new Error('comment-sicko preset registered no tool guard')
    for (const name of ['write', 'edit', 'bash', 'read']) {
      assert.equal(guard({ name }), name === 'read' ? undefined : `pstack preset denies ${name}`)
    }
  })
})

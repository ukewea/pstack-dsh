import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import AgentPresetRegistry from '@deepseek-ai/dsh-agent-preset-registry'
import {
  LlmAdapter,
  ReasoningEffortId,
  ToolCallId,
  type GenerateOptions,
  type LlmResolvedModelInfo,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import * as spawnInProcess from '@deepseek-ai/dsh-subagent-spawn-in-process'
import * as sessionPersistenceJsonl from '@deepseek-ai/dsh-session-persistence-jsonl'
import SqliteSessionQuery from '@deepseek-ai/dsh-session-query-sqlite'
import type {} from '@deepseek-ai/dsh-working-directory'
import { registerRolePresets } from '../src/index.ts'
import { defaultSkillsRoot } from '../src/skills-provider.ts'
import { developmentPlugins } from '../src/presets.ts'
import { spawnTool } from '../src/tools.ts'
import { mountCodingHostServices } from './coding-host.ts'
import {
  mountAgentLoopTestDependencies,
  mountAgentLoopTestHarness,
} from './support/agent-loop-testkit/lib/index.js'

class RecordingAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []
  private gate: Promise<void> = Promise.resolve()
  private releaseGate = () => {}

  hold(): void {
    this.gate = new Promise(resolve => { this.releaseGate = resolve })
  }

  release(): void {
    this.releaseGate()
    this.gate = Promise.resolve()
  }

  providerInfo(provider: string) {
    return { id: provider, name: provider }
  }

  async listModels(provider: string) {
    return [
      { provider, id: 'parent-model', name: 'Parent model' },
      { provider, id: 'model-a', name: 'Model A' },
      { provider, id: 'model-b', name: 'Model B' },
    ]
  }

  async resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return {
      provider,
      id: model,
      name: model,
      inputModalities: ['text'],
      reasoning: {
        efforts: [
          { id: ReasoningEffortId('low'), name: 'Low' },
          { id: ReasoningEffortId('high'), name: 'High' },
        ],
      },
    }
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    await new Promise<void>((resolve, reject) => {
      const abort = () => reject(options.signal?.reason ?? new Error('aborted'))
      if (options.signal?.aborted === true) { abort(); return }
      const finish = () => {
        options.signal?.removeEventListener('abort', abort)
        resolve()
      }
      options.signal?.addEventListener('abort', abort, { once: true })
      this.gate.then(finish, reject)
    })
    const text = 'child-ok'
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

async function waitFor(label: string, ready: () => boolean | Promise<boolean>): Promise<void> {
  const started = Date.now()
  while (!await ready()) {
    if (Date.now() - started > 5000) throw new Error(`timed out waiting for ${label}`)
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

async function openLive(maxActive = 4) {
  const root = await mkdtemp(join(tmpdir(), 'pstack-live-'))
  const parentDir = join(root, 'parent')
  await mkdir(parentDir)
  const ctx = new Context()
  await mountAgentLoopTestDependencies(ctx, { workingDirectory: true })
  await mountCodingHostServices(ctx)
  const adapter = new RecordingAdapter()
  ctx.llm.registerAdapter(['deepseek-official'], adapter)
  const harness = await mountAgentLoopTestHarness(ctx)
  await ctx.plugin(Loader)
  await ctx.plugin(AgentPresetRegistry, { default: 'pstack-poteto' })
  registerRolePresets(ctx)
  await ctx.plugin(SubagentRuntime, { maxDepth: 2, maxActiveSubagents: maxActive })
  const runtime = ctx.subagents
  const spawnProvider = await ctx.plugin(spawnInProcess, { providerName: 'spawn' })
  const parent = await harness.create(SessionId(`parent-${root.slice(-6)}`), {
    provider: 'deepseek-official',
    model: 'parent-model',
    reasoningEffort: ReasoningEffortId('low'),
  }, { cwd: parentDir })
  const tool = spawnTool({
    subagents: runtime,
    llm: ctx.llm,
    dshHome: root,
    env: { DSH_HOME: root, DEEPSEEK_API_KEY: 'test-key' },
  })
  return { ctx, root, parentDir, adapter, runtime, parent, tool, spawnProvider }
}

async function writeOverlay(root: string, roles: unknown): Promise<void> {
  await writeFile(join(root, 'pstack-dsh.json'), JSON.stringify({ version: 1, roles }))
}

function routeOf(request: GenerateOptions | undefined) {
  return {
    provider: request?.provider,
    model: request?.model,
    effort: request?.reasoningEffort === undefined ? undefined : String(request.reasoningEffort),
    sessionId: request?.sessionId === undefined ? undefined : String(request.sessionId),
  }
}

describe('real child agent on the in-process runtime', () => {
  it('puts overlay route and effort on the child first model request, and inherits when unmapped', async () => {
    const live = await openLive()
    try {
      await writeOverlay(live.root, {
        feature: { inherit: false, routes: [{ provider: 'deepseek-official', model: 'model-a', reasoningEffort: 'high' }] },
        'bug-fix': { inherit: true, routes: [] },
      })
      const signal = new AbortController().signal
      await live.tool.execute({
        description: 'mapped',
        prompt: 'use the overlay',
        role: 'feature',
        run_in_background: false,
      }, { agent: live.parent, signal })
      await live.tool.execute({
        description: 'inherited',
        prompt: 'use the parent',
        role: 'bug-fix',
        run_in_background: false,
      }, { agent: live.parent, signal })
      assert.deepEqual(live.adapter.requests.map(item => ({
        provider: item.provider,
        model: item.model,
        effort: item.reasoningEffort === undefined ? undefined : String(item.reasoningEffort),
      })), [
        { provider: 'deepseek-official', model: 'model-a', effort: 'high' },
        { provider: 'deepseek-official', model: 'parent-model', effort: 'low' },
      ])
      assert.notEqual(String(live.adapter.requests[0]?.sessionId), live.parent.id)
      assert.notEqual(String(live.adapter.requests[1]?.sessionId), live.parent.id)
      assert.notEqual(String(live.adapter.requests[0]?.sessionId), String(live.adapter.requests[1]?.sessionId))
    } finally {
      await live.ctx.fiber.dispose()
    }
  })

  it('keeps two parallel children on their own directories and routes', async () => {
    const live = await openLive()
    try {
      await writeOverlay(live.root, {
        feature: { inherit: false, routes: [{ provider: 'deepseek-official', model: 'model-a', reasoningEffort: 'high' }] },
        'bug-fix': { inherit: false, routes: [{ provider: 'deepseek-official', model: 'model-b', reasoningEffort: 'low' }] },
      })
      const treeA = join(live.root, 'tree-a')
      const treeB = join(live.root, 'tree-b')
      await mkdir(treeA)
      await mkdir(treeB)
      live.adapter.hold()
      const signal = new AbortController().signal
      const pending = Promise.all([
        live.tool.execute({ description: 'a', prompt: 'one', role: 'feature', cwd: treeA, run_in_background: false }, { agent: live.parent, signal }),
        live.tool.execute({ description: 'b', prompt: 'two', role: 'bug-fix', cwd: treeB, run_in_background: false }, { agent: live.parent, signal }),
      ])
      await waitFor('both first requests', () => live.adapter.requests.length >= 2)
      const children = live.ctx.agents.list().filter(agent => agent.id !== live.parent.id)
      assert.equal(children.length, 2)
      assert.deepEqual(
        children.map(agent => live.ctx.workingDirectory.get(agent.session)).sort(),
        (await Promise.all([realpath(treeA), realpath(treeB)])).sort(),
      )
      const routes = live.adapter.requests.map(routeOf).map(item => `${item.model}:${item.effort}`).sort()
      assert.deepEqual(routes, ['model-a:high', 'model-b:low'])
      live.adapter.release()
      await pending
    } finally {
      live.adapter.release()
      await live.ctx.fiber.dispose()
    }
  })

  it('gives a child its own read, search, and skill tools, and applies write policy per preset', async () => {
    const live = await openLive()
    try {
      const parentPreset = new URL('./support/parent-only-tool.mjs', import.meta.url).href
      await live.ctx.agentPresets.register({
        id: 'parent-standard',
        name: 'Parent standard',
        plugins: [
          ...developmentPlugins(),
          { id: 'parent-only', name: parentPreset },
        ],
      })
      const usable = await live.ctx.agentPresets.list()
      const broken = usable.filter(preset => preset.broken !== undefined).map(preset => `${preset.id}: ${preset.broken}`)
      assert.deepEqual(broken, [])
      const handle = await live.ctx.agents.create({
        sessionId: SessionId('parent-with-preset'),
        agentOptions: {
          provider: 'deepseek-official',
          model: 'parent-model',
          reasoningEffort: ReasoningEffortId('low'),
        },
        meta: { cwd: live.parentDir },
        setup: async (agentCtx) => {
          await live.ctx.agentPresets.mount(agentCtx, 'parent-standard')
        },
      })
      const parent = handle.agent
      assert.equal(live.ctx.tools.get('read'), undefined)
      assert.equal(live.ctx.tools.get('parent-only'), undefined)
      assert.notEqual(live.ctx.tools.get('read', parent), undefined)
      assert.notEqual(live.ctx.tools.get('grep', parent), undefined)
      assert.notEqual(live.ctx.tools.get('skill', parent), undefined)
      assert.notEqual(live.ctx.tools.get('parent-only', parent), undefined)
      const source = join(live.root, 'source.txt')
      await writeFile(source, 'visible\n')
      const signal = new AbortController().signal
      async function childFor(role: string) {
        const before = new Set(live.ctx.agents.list().map(agent => agent.id))
        live.adapter.hold()
        const pending = live.tool.execute({
          description: role,
          prompt: 'use the preset tools',
          role,
          run_in_background: false,
        }, { agent: parent, signal })
        await waitFor(`${role} child`, () => live.ctx.agents.list().some(agent => !before.has(agent.id)))
        const child = live.ctx.agents.list().find(agent => !before.has(agent.id))
        if (child === undefined) throw new Error(`${role} child was not created`)
        return { child, pending }
      }
      const sicko = await childFor('comment-sicko')
      assert.equal(live.ctx.tools.get('parent-only', sicko.child), undefined)
      for (const name of ['read', 'glob', 'grep', 'skill', 'write', 'bash']) {
        assert.notEqual(live.ctx.tools.get(name, sicko.child), undefined, `${name} missing on comment-sicko`)
      }
      const deniedPath = join(live.root, 'denied.txt')
      const denied = await live.ctx.tools.execute({
        agent: sicko.child,
        signal,
        calls: [{ type: 'tool-call', id: ToolCallId('sicko-write'), name: 'write', arguments: JSON.stringify({ file_path: deniedPath, content: 'no' }) }],
      })
      const sickoRead = await live.ctx.tools.execute({
        agent: sicko.child,
        signal,
        calls: [{ type: 'tool-call', id: ToolCallId('sicko-read'), name: 'read', arguments: JSON.stringify({ file_path: source }) }],
      })
      // poteto-mode reads leaf skills by path (../<name>/SKILL.md from its base directory),
      // so a session whose cwd is elsewhere must read the installed skills root without approval.
      const leafSkill = join(defaultSkillsRoot(), 'tdd', 'SKILL.md')
      for (const [label, agent] of [['parent', parent], ['comment-sicko', sicko.child]] as const) {
        const leaf = await live.ctx.tools.execute({
          agent,
          signal,
          calls: [{ type: 'tool-call', id: ToolCallId(`${label}-leaf`), name: 'read', arguments: JSON.stringify({ file_path: leafSkill }) }],
        })
        const leafResult = leaf.results[0]?.result
        if (leafResult?.isError !== false) throw new Error(`${label} could not read ${leafSkill}: ${JSON.stringify(leafResult)}`)
        assert.match(JSON.stringify(leafResult), /name: tdd/, label)
      }
      const deniedResult = denied.results[0]?.result
      if (deniedResult?.isError !== true) throw new Error(`comment-sicko write was allowed: ${JSON.stringify(deniedResult)}`)
      assert.match(deniedResult.error.message, /denies write/)
      await assert.rejects(() => readFile(deniedPath, 'utf8'))
      const sickoReadResult = sickoRead.results[0]?.result
      if (sickoReadResult?.isError !== false) throw new Error(`comment-sicko read failed: ${JSON.stringify(sickoReadResult)}`)
      live.adapter.release()
      await sicko.pending
      const poteto = await childFor('poteto-agent')
      assert.equal(live.ctx.tools.get('parent-only', poteto.child), undefined)
      const writtenPath = join(live.root, 'written.txt')
      const allowed = await live.ctx.tools.execute({
        agent: poteto.child,
        signal,
        calls: [{ type: 'tool-call', id: ToolCallId('poteto-write'), name: 'write', arguments: JSON.stringify({ file_path: writtenPath, content: 'yes' }) }],
      })
      const allowedResult = allowed.results[0]?.result
      if (allowedResult?.isError !== false) throw new Error(`poteto write failed: ${JSON.stringify(allowedResult)}`)
      assert.equal(await readFile(writtenPath, 'utf8'), 'yes')
      live.adapter.release()
      await poteto.pending
    } finally {
      live.adapter.release()
      await live.ctx.fiber.dispose()
    }
  })

  it('stops a full capacity child from starting another and leaves no second request', async () => {
    const live = await openLive(1)
    try {
      live.adapter.hold()
      const signal = new AbortController().signal
      const first = live.tool.execute({
        description: 'hold',
        prompt: 'stay',
        role: 'feature',
        run_in_background: false,
      }, { agent: live.parent, signal })
      await waitFor('first request', () => live.adapter.requests.length === 1)
      await assert.rejects(() => live.tool.execute({
        description: 'second',
        prompt: 'no',
        role: 'bug-fix',
        run_in_background: false,
      }, { agent: live.parent, signal }), /active child limit: 1/)
      assert.equal(live.adapter.requests.length, 1)
      live.adapter.release()
      await first
    } finally {
      live.adapter.release()
      await live.ctx.fiber.dispose()
    }
  })

  it('aborts the child when the caller signal aborts and does not notify the parent again', async () => {
    const live = await openLive()
    try {
      live.adapter.hold()
      const controller = new AbortController()
      const pending = live.tool.execute({
        description: 'cancel',
        prompt: 'stop soon',
        role: 'feature',
        run_in_background: false,
      }, { agent: live.parent, signal: controller.signal })
      await waitFor('child started', () => live.ctx.agents.list().some(agent => agent.id !== live.parent.id))
      const parentEvents: string[] = []
      live.ctx.on('session/event', (session, event) => {
        if (session.id !== live.parent.id) return
        parentEvents.push(event.type)
      })
      controller.abort()
      let stopReason = ''
      try {
        const value = await pending
        if (value !== null && typeof value === 'object' && 'stopReason' in value) stopReason = String(value.stopReason)
      } catch {
        stopReason = 'aborted'
      }
      assert.equal(stopReason, 'aborted')
      await new Promise(resolve => setTimeout(resolve, 50))
      assert.equal(parentEvents.filter(type => type === 'user/message').length, 0)
    } finally {
      live.adapter.release()
      await live.ctx.fiber.dispose()
    }
  })

  it('drains the running child when the parent tears down and does not send a late notice', async () => {
    const live = await openLive()
    try {
      live.adapter.hold()
      const parentEvents: string[] = []
      live.ctx.on('session/event', (session, event) => {
        if (session.id !== live.parent.id) return
        parentEvents.push(event.type)
      })
      const signal = new AbortController().signal
      const pending = live.tool.execute({
        description: 'teardown',
        prompt: 'stop with parent',
        role: 'feature',
        run_in_background: false,
      }, { agent: live.parent, signal })
      await waitFor('child for teardown', () => live.adapter.requests.length === 1)
      await live.runtime.drainDescendants([live.parent])
      let stopReason = ''
      try {
        const value = await pending
        if (value !== null && typeof value === 'object' && 'stopReason' in value) stopReason = String(value.stopReason)
      } catch {
        stopReason = 'aborted'
      }
      assert.equal(stopReason, 'aborted')
      assert.equal(live.ctx.agents.list().some(agent => agent.id !== live.parent.id), false)
      await new Promise(resolve => setTimeout(resolve, 50))
      assert.equal(parentEvents.filter(type => type === 'user/message').length, 0)
    } finally {
      live.adapter.release()
      await live.ctx.fiber.dispose()
    }
  })

  it('resumes the same child after it settles', async () => {
    const live = await openLive()
    try {
      const sessions = join(live.root, 'sessions')
      await mkdir(sessions)
      await live.ctx.plugin(sessionPersistenceJsonl, { root: sessions, compression: 'none' })
      await live.ctx.plugin(SqliteSessionQuery, { path: join(live.root, 'query.sqlite'), openAt: 'never' })
      await writeOverlay(live.root, {
        feature: { inherit: false, routes: [{ provider: 'deepseek-official', model: 'model-a', reasoningEffort: 'high' }] },
      })
      const signal = new AbortController().signal
      live.adapter.hold()
      const started = await live.tool.execute({
        description: 'first',
        prompt: 'start',
        role: 'feature',
        run_in_background: true,
      }, { agent: live.parent, signal })
      if (started === null || typeof started !== 'object' || !('subagentId' in started)) throw new Error('background spawn did not return a child id')
      const childId = String(started.subagentId)
      const childRequests = () => live.adapter.requests.filter(request => String(request.sessionId) === childId)
      await waitFor('first child request', () => childRequests().length === 1)
      assert.equal(childRequests()[0]?.model, 'model-a')
      assert.equal(String(childRequests()[0]?.reasoningEffort), 'high')
      live.adapter.release()
      await waitFor('child settled', () => !live.ctx.agents.list().some(agent => agent.id === childId) && live.parent.status === 'idle')
      const parentRequests = live.adapter.requests.filter(request => String(request.sessionId) === live.parent.id)
      assert.equal(parentRequests.length, 1)
      live.adapter.hold()
      await live.runtime.sendMessage(live.parent, SessionId(childId), [{ type: 'text', text: 'continue' }], { signal })
      await waitFor('resumed request', () => childRequests().length === 2)
      assert.equal(childRequests()[1]?.model, 'model-a')
      assert.equal(String(childRequests()[1]?.reasoningEffort), 'high')
      live.adapter.release()
    } finally {
      live.adapter.release()
      await live.ctx.fiber.dispose()
    }
  })

  it('unregisters the spawn provider with its plugin and still settles the child already started', async () => {
    const live = await openLive()
    try {
      live.adapter.hold()
      const signal = new AbortController().signal
      const pending = live.tool.execute({
        description: 'inflight',
        prompt: 'keep going',
        role: 'feature',
        run_in_background: false,
      }, { agent: live.parent, signal })
      await waitFor('inflight request', () => live.adapter.requests.length === 1)
      await live.spawnProvider.dispose()
      assert.equal(live.runtime.getProvider('spawn'), undefined)
      await assert.rejects(() => live.tool.execute({
        description: 'after',
        prompt: 'too late',
        role: 'bug-fix',
        run_in_background: false,
      }, { agent: live.parent, signal }), /spawn/)
      assert.equal(live.adapter.requests.length, 1)
      live.adapter.release()
      const settled = await pending
      assert.equal(settled && typeof settled === 'object' && 'kind' in settled && settled.kind, 'foreground')
    } finally {
      live.adapter.release()
      await live.ctx.fiber.dispose()
    }
  })
})

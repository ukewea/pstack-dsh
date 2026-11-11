import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import AgentPresetRegistry from '@deepseek-ai/dsh-agent-preset-registry'
import { registerRolePresets, watchRolePresets } from '../src/index.ts'
import { COMMENT_SICKO_PRESET_ID, POTETO_PRESET_ID } from '../src/presets.ts'
import { mountCodingHostServices } from './coding-host.ts'
import { mountAgentLoopTestDependencies } from './support/agent-loop-testkit/lib/index.js'

function presetPlugin(ctx: Context): void {
  registerRolePresets(ctx)
}

async function openRegistry() {
  const ctx = new Context()
  await mountAgentLoopTestDependencies(ctx, { workingDirectory: true })
  await mountCodingHostServices(ctx)
  await ctx.plugin(Loader)
  await ctx.plugin(AgentPresetRegistry, { default: POTETO_PRESET_ID })
  return ctx
}

async function idsOf(ctx: Context): Promise<string[]> {
  const listed = await ctx.agentPresets.list()
  return listed.map(preset => preset.id).sort()
}

describe('agent preset registration lifecycle', () => {
  it('registers both presets when the registry starts after the plugin applied', async () => {
    // Live Host order: pstack applies before the agentPresets service is ready.
    const ctx = new Context()
    try {
      await mountAgentLoopTestDependencies(ctx, { workingDirectory: true })
      await mountCodingHostServices(ctx)
      await ctx.plugin(Loader)
      await ctx.plugin(watchRolePresets)
      await ctx.plugin(AgentPresetRegistry, { default: POTETO_PRESET_ID })
      const deadline = Date.now() + 5000
      let ids = await idsOf(ctx)
      while (ids.length < 2 && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 25))
        ids = await idsOf(ctx)
      }
      assert.deepEqual(ids, [COMMENT_SICKO_PRESET_ID, POTETO_PRESET_ID].sort())
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('removes both presets when the declaring plugin unloads and can register them again', async () => {
    const ctx = await openRegistry()
    try {
      const first = ctx.plugin(presetPlugin)
      await first
      const listed = await ctx.agentPresets.list()
      assert.deepEqual(listed.map(preset => preset.id).sort(), [COMMENT_SICKO_PRESET_ID, POTETO_PRESET_ID].sort())
      assert.equal(listed.every(preset => preset.broken === undefined), true, listed.map(preset => preset.broken).join('\n'))
      await first.dispose()
      assert.deepEqual(await idsOf(ctx), [])
      const second = ctx.plugin(presetPlugin)
      await second
      assert.deepEqual(await idsOf(ctx), [COMMENT_SICKO_PRESET_ID, POTETO_PRESET_ID].sort())
      await second.dispose()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('unregisters a preset whose register call is still pending when the plugin unloads', async () => {
    const ctx = await openRegistry()
    try {
      const original = ctx.agentPresets.register.bind(ctx.agentPresets)
      let openGate = () => {}
      const gate = new Promise<void>(resolve => { openGate = resolve })
      ctx.agentPresets.register = definition => {
        const pending = original(definition)
        return gate.then(() => pending)
      }
      const plugin = ctx.plugin(presetPlugin)
      await plugin
      assert.deepEqual(await idsOf(ctx), [COMMENT_SICKO_PRESET_ID, POTETO_PRESET_ID].sort())
      const unloading = plugin.dispose()
      let settled = false
      unloading.then(() => { settled = true }, () => { settled = true })
      await new Promise(resolve => setTimeout(resolve, 30))
      assert.equal(settled, false)
      openGate()
      await unloading
      assert.deepEqual(await idsOf(ctx), [])
      ctx.agentPresets.register = original
      const again = ctx.plugin(presetPlugin)
      await again
      assert.deepEqual(await idsOf(ctx), [COMMENT_SICKO_PRESET_ID, POTETO_PRESET_ID].sort())
      await again.dispose()
    } finally {
      await ctx.fiber.dispose()
    }
  })
})

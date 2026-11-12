/**
 * pstack-dsh: DeepSeek Harness port of official pstack.
 * Function/namespace plugin: named apply, no default export.
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type { AgentPresetRegistry, PresetDefinition } from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-skill'
import type { SubagentRuntime } from '@deepseek-ai/dsh-subagent'
import { defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import { snapshotJsonValue, type JsonValue } from '@deepseek-ai/dsh-util-values'
import { watchChildSkillHint } from './child-skill-hint.ts'
import { BOOT_MARKER, PLUGIN_ID, SPAWN_PROVIDER } from './ids.ts'
import { Config, type Config as PluginConfig } from './plugin-config.ts'
import { COMMENT_SICKO_PRESET_ID, POTETO_PRESET_ID, rolePresetPlugins } from './presets.ts'
import { createSkillProvider } from './skills-provider.ts'
import {
  catalogTool,
  overlayReadTool,
  overlayWriteTool,
  spawnTool,
  type ToolHost,
} from './tools.ts'
import { registerPstackSettingsRoutes } from './settings-routes.ts'

export const name = PLUGIN_ID
export const inject = ['tools', 'skills']
export { Config }
export type { PluginConfig as ConfigType }

const JSON_OUTPUT = {
  schema: { type: 'json' as const },
  render: (_args: unknown, value: JsonValue) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
}

function asHost(ctx: Context, config: PluginConfig | undefined): ToolHost {
  return {
    get llm(): ToolHost['llm'] { return ctx.get('llm') },
    get credentials(): ToolHost['credentials'] { return ctx.get('credentials') },
    get settings(): ToolHost['settings'] { return ctx.get('settings') },
    get subagents(): SubagentRuntime | undefined { return ctx.get('subagents') },
    spawnProvider: config?.spawnProvider ?? SPAWN_PROVIDER,
  }
}

function registerOne(ctx: Context, tool: ReturnType<typeof catalogTool>): void {
  ctx.tools.register(defineTool({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    output: JSON_OUTPUT,
    async execute(args: Record<string, unknown>, exec: ToolRunContext): Promise<JsonValue> {
      const snapshot = snapshotJsonValue(await tool.execute(args, exec))
      if (snapshot === undefined) throw new TypeError(`pstack tool ${tool.name} returned a non-JSON value`)
      return snapshot as JsonValue
    },
  }))
}

export function apply(ctx: Context, config?: PluginConfig): void {
  console.log(BOOT_MARKER)
  const host = asHost(ctx, config)
  registerOne(ctx, catalogTool(host))
  registerOne(ctx, overlayReadTool(host))
  registerOne(ctx, overlayWriteTool(host))
  registerOne(ctx, spawnTool(host))
  watchRolePresets(ctx)
  watchChildSkillHint(ctx)
  ctx.skills.registerProvider(control => createSkillProvider(ctx, control))
  ctx.inject(['webServer', 'connection'], webCtx => {
    registerPstackSettingsRoutes(webCtx, host)
  })

}

function presetRegistry(ctx: Context): AgentPresetRegistry | undefined {
  const value: unknown = ctx.get('agentPresets')
  if (typeof value !== 'object' || value === null || !('register' in value) || typeof value.register !== 'function') return undefined
  return value as AgentPresetRegistry
}

/**
 * Register the role presets once the agentPresets service is up. In the live
 * Host that service finishes starting after this plugin applies, so reading it
 * during apply finds nothing; the inject scope also drops the presets with it.
 */
export function watchRolePresets(ctx: Context): void {
  ctx.inject(['agentPresets'], registerRolePresets)
}

export function registerRolePresets(ctx: Context): void {
  const presets = presetRegistry(ctx)
  if (presets === undefined) return
  const definitions: PresetDefinition[] = [
    { id: POTETO_PRESET_ID, name: 'Poteto', plugins: rolePresetPlugins(false) },
    { id: COMMENT_SICKO_PRESET_ID, name: 'Comment Sicko', plugins: rolePresetPlugins(true) },
  ]
  for (const definition of definitions) {
    ctx.effect(async () => {
      try {
        return await presets.register(definition)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`pstack-dsh: failed to register agent preset ${definition.id}: ${message}`)
        return () => {}
      }
    }, `pstack-dsh preset ${definition.id}`)
  }
}

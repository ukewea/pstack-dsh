import { join } from 'node:path'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { SubagentRuntime, SubagentStartRequest } from '@deepseek-ai/dsh-subagent'
import type { ParameterSchemaSpec } from '@deepseek-ai/dsh-tools'
import type { CatalogHost } from './catalog.ts'
import { buildCatalog } from './catalog.ts'
import {
  parseOverlay,
  readOverlay,
  validateOverlayAgainstCatalog,
  writeOverlay,
  type Overlay,
} from './overlay.ts'
import { resolveDshHome } from './home.ts'
import { loadPersona } from './persona.ts'
import { presetForRole } from './presets.ts'
import { assertSelectableRoute, resolveSpawn } from './spawn.ts'
import { isPstackRole, normalizeRole } from './roles.ts'
import {
  SPAWN_PROVIDER,
  TOOL_CATALOG,
  TOOL_OVERLAY_READ,
  TOOL_OVERLAY_WRITE,
  TOOL_SPAWN,
} from './ids.ts'
import { defaultSkillsRoot } from './skills-provider.ts'

export interface ToolDefinition {
  name: string
  description: string
  parameters: ParameterSchemaSpec
  execute(args: Record<string, unknown>, exec: { signal?: AbortSignal; agent?: Agent }): Promise<unknown>
}

/** Public subagent methods this plugin calls. Signatures come from {@link SubagentRuntime}. */
export type SpawnSubagents = Pick<SubagentRuntime, 'startActivation' | 'getProvider' | 'resolveMaxDepth'>

export interface ToolHost {
  llm?: CatalogHost['llm']
  credentials?: CatalogHost['credentials']
  settings?: CatalogHost['settings']
  subagents?: SpawnSubagents
  dshHome?: string
  env?: NodeJS.ProcessEnv
  spawnProvider?: string
}

function textPrompt(prompt: string): ContentBlock[] {
  return [{ type: 'text', text: prompt }]
}

/**
 * Where a poteto-agent child finds poteto-mode. Upstream asks the parent to pass this path;
 * pstack_spawn supplies it so a child never searches for the skill.
 */
function potetoModeLocation(role: string): string | undefined {
  if (normalizeRole(role) === 'comment-sicko') return undefined
  return `poteto-mode: ${join(defaultSkillsRoot(), 'poteto-mode', 'SKILL.md')} (bundled pstack skills live beside it at ../<name>/SKILL.md).`
}

export function catalogTool(host: ToolHost): ToolDefinition {
  return {
    name: TOOL_CATALOG,
    description:
      'List live DSH LLM routes pstack may use: registered adapters with a logged-in API key, plus OAuth store routes (dsh-oauth-login, dsh-antigravity-oauth) that are already signed in. Never a vendor catalog. Secrets are omitted.',
    parameters: {},
    async execute(_args, exec) {
      return buildCatalog({
        llm: host.llm,
        credentials: host.credentials,
        settings: host.settings,
        dshHome: host.dshHome,
        env: host.env,
      }, exec.signal)
    },
  }
}

export function overlayReadTool(host: ToolHost): ToolDefinition {
  return {
    name: TOOL_OVERLAY_READ,
    description: 'Read $DSH_HOME/pstack-dsh.json. Missing file means inherit the parent conversation for every role.',
    parameters: {},
    async execute() {
      const current = await readOverlay(host.dshHome ?? resolveDshHome(host.env))
      return {
        path: current.path,
        missing: current.missing,
        overlay: current.overlay,
      }
    },
  }
}

export function overlayWriteTool(host: ToolHost): ToolDefinition {
  return {
    name: TOOL_OVERLAY_WRITE,
    description:
      'Write $DSH_HOME/pstack-dsh.json after validating every provider/model/effort against pstack_catalog. inherit-parent is stored as inherit: true with empty routes.',
    parameters: {
      overlay: {
        type: 'json',
        required: true,
        description: 'Full overlay object { version: 1, roles: { <role>: { inherit, routes } } }',
      },
    },
    async execute(args) {
      const overlay = typeof args.overlay === 'string'
        ? parseOverlay(args.overlay)
        : parseOverlay(JSON.stringify(args.overlay))
      const catalog = await buildCatalog({
        llm: host.llm,
        credentials: host.credentials,
        settings: host.settings,
        dshHome: host.dshHome,
        env: host.env,
      })
      const errors = validateOverlayAgainstCatalog(overlay, catalog.routes)
      if (errors.length > 0) {
        throw new Error(`overlay rejected against live catalog:\n${errors.join('\n')}`)
      }
      const path = await writeOverlay(overlay, host.dshHome ?? resolveDshHome(host.env))
      return { path, overlay }
    },
  }
}

export function spawnTool(host: ToolHost): ToolDefinition {
  return {
    name: TOOL_SPAWN,
    description:
      'Delegate a pstack role through ctx.subagents.startActivation on the spawn provider. Send description, prompt, role, optional cwd, and optional run_in_background. Do not send model, provider, reasoning_effort, thinking, isolation, or subagent_type. A mapped overlay route is checked against the live catalog and placed on the child agentOptions before the first request. Omitted or true run_in_background returns the child id immediately and the runtime notifies the parent once. false waits for that result here and does not also notify the parent.',
    parameters: {
      description: {
        type: 'string',
        required: true,
        description: 'A short (3-5 word) description of the delegated task, for display.',
      },
      prompt: {
        type: 'string',
        required: true,
        description: 'The complete, self-contained task. The child does not see this conversation.',
      },
      role: {
        type: 'string',
        required: true,
        description: 'pstack role key (feature, how-explainer, poteto-agent, comment-sicko, …).',
      },
      cwd: {
        type: 'string',
        description: 'Initial child working directory. This is not a sandbox or a private worktree. Parallel writers need separate directories.',
      },
      run_in_background: {
        type: 'boolean',
        description: 'Default true. true returns the child id and lets the runtime notify the parent once. false waits for the result in this call and does not also notify the parent.',
      },
      route_index: {
        type: 'number',
        description: 'Which overlay route to use for a panel role. Default 0.',
      },
    },
    async execute(args, exec) {
      const parent = exec.agent
      if (parent === undefined) throw new Error('pstack_spawn requires a calling agent')
      const subagents = host.subagents
      if (subagents === undefined) throw new Error('pstack_spawn requires ctx.subagents')
      const role = normalizeRole(String(args.role ?? ''))
      if (role === 'how-critics') {
        return { kind: 'disabled', role, reason: 'how-critics was retired in pstack 0.15; no agent was started.' }
      }
      if (!isPstackRole(role) && role.length === 0) throw new Error('pstack_spawn role is required')
      const overlay: Overlay = (await readOverlay(host.dshHome ?? resolveDshHome(host.env))).overlay
      const resolved = resolveSpawn(overlay, {
        role,
        description: String(args.description ?? ''),
        prompt: String(args.prompt ?? ''),
        runInBackground: args.run_in_background !== false,
        routeIndex: typeof args.route_index === 'number' ? args.route_index : undefined,
      })
      if (resolved.description.trim().length === 0) throw new Error('description is required')
      if (resolved.prompt.trim().length === 0) throw new Error('prompt is required')

      if (resolved.route !== undefined) {
        if (host.llm === undefined) {
          throw new Error('pstack_spawn cannot check route authorization because the llm service is unavailable')
        }
        const catalog = await buildCatalog({
          llm: host.llm,
          credentials: host.credentials,
          settings: host.settings,
          dshHome: host.dshHome,
          env: host.env,
        }, exec.signal)
        assertSelectableRoute(resolved.route, catalog.routes)
      }

      const persona = await loadPersona(resolved.role)
      const prompt = [persona, potetoModeLocation(resolved.role), resolved.prompt]
        .filter((part): part is string => part !== undefined)
        .join('\n\n')
      const providerName = host.spawnProvider ?? SPAWN_PROVIDER
      const provider = subagents.getProvider?.(providerName)
      const preset = presetForRole(resolved.role)
      const presetSupported = provider?.capabilities?.agentPreset === true && provider.inheritsParentContext !== true
      if (preset.restrictsWrites && !presetSupported) {
        throw new Error(`pstack_spawn role ${resolved.role} requires agent preset ${preset.id}, but provider "${providerName}" cannot apply an independent preset. Refusing to start with only a prompt restriction.`)
      }
      const signal = exec.signal ?? new AbortController().signal
      const maxDepth = subagents.resolveMaxDepth?.()
      const request: Omit<SubagentStartRequest, 'label' | 'signal'> = {
        prompt: textPrompt(prompt),
        parent,
        ...typeof args.cwd === 'string' && args.cwd.length > 0 ? { cwd: args.cwd } : {},
        ...resolved.agentOptions === undefined ? {} : { agentOptions: resolved.agentOptions },
        ...presetSupported ? { agentPreset: preset.id } : {},
        ...maxDepth !== undefined ? { maxDepth } : {},
      }
      const activation = await subagents.startActivation({
        provider: providerName,
        label: resolved.description,
        request,
        signal,
        delivery: resolved.runInBackground ? 'parent' : 'caller',
      })
      if (resolved.runInBackground) {
        return { kind: 'activation', subagentId: activation.childId, role: resolved.role, inherit: resolved.inherit }
      }
      const cancel = () => { void activation.dispose() }
      signal.addEventListener('abort', cancel, { once: true })
      try {
        if (signal.aborted) await activation.dispose()
        const result = await activation.result
        await activation.dispose()
        return {
          kind: 'foreground',
          subagentId: activation.childId,
          role: resolved.role,
          inherit: resolved.inherit,
          output: result.output ?? null,
          stopReason: result.stopReason ?? 'completed',
        }
      } finally {
        signal.removeEventListener('abort', cancel)
      }
    },
  }
}

export const ALL_TOOLS = [catalogTool, overlayReadTool, overlayWriteTool, spawnTool] as const

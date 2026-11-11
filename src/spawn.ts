import type { AgentOptions } from '@deepseek-ai/dsh-agent'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { LiveRoute } from './catalog-types.ts'
import type { Overlay, OverlayRoute } from './overlay.ts'
import { resolveRole } from './overlay.ts'
import { normalizeRole } from './roles.ts'

export interface SpawnRequest {
  readonly role: string
  readonly description: string
  readonly prompt: string
  readonly runInBackground: boolean
  readonly routeIndex?: number
}

export interface ResolvedSpawn {
  readonly role: string
  readonly description: string
  readonly prompt: string
  readonly runInBackground: boolean
  readonly inherit: boolean
  readonly agentOptions?: AgentOptions
  readonly route?: OverlayRoute
}

export function resolveSpawn(overlay: Overlay, request: SpawnRequest): ResolvedSpawn {
  const role = normalizeRole(request.role)
  const assignment = resolveRole(overlay, role)
  const inherit = assignment.inherit || assignment.routes.length === 0
  const index = request.routeIndex ?? 0
  if (!inherit && (!Number.isInteger(index) || index < 0 || index >= assignment.routes.length)) {
    throw new Error(`pstack_spawn route_index ${String(request.routeIndex)} is outside ${assignment.routes.length} route(s) for ${role}`)
  }
  const route = inherit ? undefined : assignment.routes[index]
  return {
    role,
    description: request.description,
    prompt: request.prompt,
    runInBackground: request.runInBackground,
    inherit,
    ...route === undefined
      ? {}
      : {
        agentOptions: {
          provider: route.provider,
          model: route.model,
          ...route.reasoningEffort === undefined ? {} : { reasoningEffort: ReasoningEffortId(route.reasoningEffort) },
        },
        route,
      },
  }
}

export function assertSelectableRoute(route: OverlayRoute, routes: readonly LiveRoute[]): void {
  const match = routes.find(item => item.selectable && item.provider === route.provider && item.model === route.model)
  if (match === undefined) {
    throw new Error(`pstack_spawn route ${route.provider}/${route.model} is not a selectable live route. Refusing to substitute another route.`)
  }
  if (route.reasoningEffort !== undefined && !match.efforts.some(effort => effort.id === route.reasoningEffort)) {
    throw new Error(`pstack_spawn route ${route.provider}/${route.model} does not list reasoning effort "${route.reasoningEffort}". Refusing to substitute another effort.`)
  }
}

/** Fields a skill may send on pstack_spawn. Official `subagent` has no model/effort. */
export const SPAWN_MODEL_FIELDS = ['description', 'prompt', 'role', 'run_in_background', 'route_index'] as const

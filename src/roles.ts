/**
 * pstack role keys used by playbooks and Settings → pstack.
 * These are pstack names, not Cursor slugs and not grok-build `subagent_type` values.
 */

export const SCALAR_ROLES = [
  'feature',
  'refactoring',
  'bug-fix',
  'perf-issue',
  'hillclimb',
  'judgment-and-prose',
  'hardest-tasks',
  'how-explorer',
  'how-explainer',
  'why-investigators',
  'why-synthesizer',
  'reflect-tooling',
  'reflect-judgment',
  'swarm-workers',
  'independent-verifier',
  'poteto-agent',
  'comment-sicko',
] as const

export const PANEL_ROLES = [
  'how-critics',
  'arena-runners',
  'arena-cross-judge-pool',
  'architect-runners',
  'interrogate-reviewers',
] as const

export const ALL_ROLES = [...SCALAR_ROLES, ...PANEL_ROLES] as const

/**
 * Roles upstream pstack dropped. They stay in ALL_ROLES so an existing overlay still parses and keeps
 * its value on save, but Settings hides them, the catalog check skips them, and pstack_spawn refuses them.
 */
export const RETIRED_ROLES = {
  'how-critics': '0.15',
  'hardest-tasks': '0.15.43',
  'how-explorer': '0.15.43',
  'how-explainer': '0.15.43',
  'why-investigators': '0.15.43',
  'why-synthesizer': '0.15.43',
  'reflect-tooling': '0.15.43',
  'reflect-judgment': '0.15.43',
  'architect-runners': '0.15.43',
} as const satisfies Partial<Record<(typeof ALL_ROLES)[number], string>>

export type RetiredRole = keyof typeof RETIRED_ROLES

export function isRetiredRole(value: string): value is RetiredRole {
  return Object.hasOwn(RETIRED_ROLES, value)
}

export const ACTIVE_ROLES = ALL_ROLES.filter(role => !isRetiredRole(role))

export type ScalarRole = (typeof SCALAR_ROLES)[number]
export type PanelRole = (typeof PANEL_ROLES)[number]
export type PstackRole = (typeof ALL_ROLES)[number]

export function isPstackRole(value: string): value is PstackRole {
  return (ALL_ROLES as readonly string[]).includes(value)
}

export function isPanelRole(value: string): value is PanelRole {
  return (PANEL_ROLES as readonly string[]).includes(value)
}

/** Alias accepted from Cursor-era skills. */
export function normalizeRole(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed === 'Comment Sicko' || trimmed === 'comment sicko') return 'comment-sicko'
  if (trimmed === 'poteto-agent' || trimmed === 'Poteto Agent') return 'poteto-agent'
  if (trimmed === 'generalPurpose' || trimmed === 'general-purpose') return 'poteto-agent'
  return trimmed
}

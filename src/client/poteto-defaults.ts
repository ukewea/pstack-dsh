import type { PstackRole } from '../roles.ts'

// Upstream 0.15.36 (setup-pstack step 5) recommendations are display copy, never runtime route defaults.
const GROK = 'grok-4.7-xhigh-fast'
const OPUS = 'claude-opus-5-5-xhigh'
const PANEL = `${OPUS}, ${GROK}`

export const POTETO_DEFAULT_SLUGS = {
  feature: GROK,
  refactoring: GROK,
  'bug-fix': GROK,
  'perf-issue': GROK,
  hillclimb: GROK,
  'judgment-and-prose': OPUS,
  'hardest-tasks': OPUS,
  'how-explorer': GROK,
  'how-explainer': OPUS,
  'why-investigators': GROK,
  'why-synthesizer': OPUS,
  'reflect-tooling': GROK,
  'reflect-judgment': OPUS,
  'swarm-workers': GROK,
  'independent-verifier': '',
  'poteto-agent': '',
  'comment-sicko': '',
  'how-critics': '',
  'arena-runners': PANEL,
  'arena-cross-judge-pool': PANEL,
  'architect-runners': PANEL,
  'interrogate-reviewers': PANEL,
} as const satisfies Record<PstackRole, string>

export function potetoNoteCopy(role: PstackRole, prefix: string): string {
  const slugs = POTETO_DEFAULT_SLUGS[role]
  return slugs.length === 0 ? '' : `${prefix}${slugs}`
}

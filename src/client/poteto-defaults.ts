import type { PstackRole } from '../roles.ts'

// Upstream 0.15.48 (setup-pstack step 5) recommendations are display copy, never runtime route defaults.
const OPUS = 'claude-opus-5-5-xhigh-fast'
const OPUS_HIGH = 'claude-opus-5-5-high-fast'
const GEMINI = 'gemini-4-neon-xhigh'
const PANEL = `claude-fable-5-2-high, ${OPUS_HIGH}, ${GEMINI}`

export const POTETO_DEFAULT_SLUGS = {
  feature: OPUS,
  refactoring: OPUS,
  'bug-fix': OPUS,
  'perf-issue': OPUS,
  hillclimb: OPUS,
  'judgment-and-prose': OPUS,
  'swarm-workers': OPUS_HIGH,
  'independent-verifier': '',
  'poteto-agent': '',
  'comment-sicko': '',
  'arena-runners': PANEL,
  'arena-cross-judge-pool': `${OPUS_HIGH}, ${GEMINI}`,
  'interrogate-reviewers': PANEL,
  // Retired upstream: no recommendation.
  'hardest-tasks': '',
  'how-explorer': '',
  'how-explainer': '',
  'why-investigators': '',
  'why-synthesizer': '',
  'reflect-tooling': '',
  'reflect-judgment': '',
  'how-critics': '',
  'architect-runners': '',
} as const satisfies Record<PstackRole, string>

export function potetoNoteCopy(role: PstackRole, prefix: string): string {
  const slugs = POTETO_DEFAULT_SLUGS[role]
  return slugs.length === 0 ? '' : `${prefix}${slugs}`
}

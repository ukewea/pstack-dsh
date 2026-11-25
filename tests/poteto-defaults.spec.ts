import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { en, zh } from '../src/client/locales.ts'
import { POTETO_DEFAULT_SLUGS, potetoNoteCopy } from '../src/client/poteto-defaults.ts'
import { ALL_ROLES, type PstackRole } from '../src/roles.ts'

// pstack 0.15.48 (9e278fe) skills/setup-pstack/SKILL.md step 5. Retired roles have no recommendation.
const OPUS = 'claude-opus-5-5-xhigh-fast'
const OPUS_HIGH = 'claude-opus-5-5-high-fast'
const PANEL = 'claude-fable-5-2-high, claude-opus-5-5-high-fast, gemini-4-neon-xhigh'

const EXPECTED: Record<PstackRole, string> = {
  feature: OPUS,
  refactoring: OPUS,
  'bug-fix': OPUS,
  'perf-issue': OPUS,
  hillclimb: OPUS,
  'judgment-and-prose': OPUS,
  'swarm-workers': OPUS_HIGH,
  'arena-runners': PANEL,
  'arena-cross-judge-pool': 'claude-opus-5-5-high-fast, gemini-4-neon-xhigh',
  'interrogate-reviewers': PANEL,
  'independent-verifier': '',
  'poteto-agent': '',
  'comment-sicko': '',
  'hardest-tasks': '',
  'how-explorer': '',
  'how-explainer': '',
  'why-investigators': '',
  'why-synthesizer': '',
  'reflect-tooling': '',
  'reflect-judgment': '',
  'how-critics': '',
  'architect-runners': '',
}

describe('Poteto Settings notes', () => {
  it('matches official setup-pstack step 5 slugs for every role', () => {
    assert.deepEqual([...ALL_ROLES].sort(), Object.keys(EXPECTED).sort())
    for (const role of ALL_ROLES) {
      assert.equal(POTETO_DEFAULT_SLUGS[role], EXPECTED[role])
    }
  })

  it('formats zh and en notes without inherit-parent lectures', () => {
    assert.equal(en.potetoPrefix, 'Poteto 0.15 recommendation: ')
    assert.equal(zh.potetoPrefix, 'Poteto 0.15 推荐：')
    assert.ok(!('inheritHint' in en))
    assert.ok(!('panelHint' in en))
    assert.equal(potetoNoteCopy('feature', en.potetoPrefix), `Poteto 0.15 recommendation: ${OPUS}`)
    assert.equal(potetoNoteCopy('feature', zh.potetoPrefix), `Poteto 0.15 推荐：${OPUS}`)
    assert.equal(potetoNoteCopy('swarm-workers', en.potetoPrefix), `Poteto 0.15 recommendation: ${OPUS_HIGH}`)
    assert.equal(potetoNoteCopy('hardest-tasks', en.potetoPrefix), '')
    assert.equal(potetoNoteCopy('arena-runners', zh.potetoPrefix), `Poteto 0.15 推荐：${PANEL}`)
    assert.equal(potetoNoteCopy('how-critics', en.potetoPrefix), '')
    assert.equal(potetoNoteCopy('how-critics', zh.potetoPrefix), '')
    assert.equal(potetoNoteCopy('independent-verifier', en.potetoPrefix), '')
    assert.equal(potetoNoteCopy('poteto-agent', zh.potetoPrefix), '')
    assert.equal(potetoNoteCopy('comment-sicko', en.potetoPrefix), '')
  })
})

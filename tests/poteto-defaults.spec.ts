import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { en, zh } from '../src/client/locales.ts'
import { POTETO_DEFAULT_SLUGS, potetoNoteCopy } from '../src/client/poteto-defaults.ts'
import { ALL_ROLES, type PstackRole } from '../src/roles.ts'

// pstack 0.15.36 (de8ee15) skills/setup-pstack/SKILL.md step 5.
const GROK = 'grok-4.7-xhigh-fast'
const OPUS = 'claude-opus-5-5-xhigh'
const PANEL = 'claude-opus-5-5-xhigh, grok-4.7-xhigh-fast'

const EXPECTED: Record<PstackRole, string> = {
  feature: GROK,
  refactoring: GROK,
  'how-explorer': GROK,
  'why-investigators': GROK,
  'swarm-workers': GROK,
  'bug-fix': GROK,
  'perf-issue': GROK,
  hillclimb: GROK,
  'reflect-tooling': GROK,
  'judgment-and-prose': OPUS,
  'hardest-tasks': OPUS,
  'how-explainer': OPUS,
  'why-synthesizer': OPUS,
  'reflect-judgment': OPUS,
  'how-critics': '',
  'arena-runners': PANEL,
  'arena-cross-judge-pool': PANEL,
  'architect-runners': PANEL,
  'interrogate-reviewers': PANEL,
  'independent-verifier': '',
  'poteto-agent': '',
  'comment-sicko': '',
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
    assert.equal(potetoNoteCopy('feature', en.potetoPrefix), `Poteto 0.15 recommendation: ${GROK}`)
    assert.equal(potetoNoteCopy('feature', zh.potetoPrefix), `Poteto 0.15 推荐：${GROK}`)
    assert.equal(potetoNoteCopy('bug-fix', en.potetoPrefix), `Poteto 0.15 recommendation: ${GROK}`)
    assert.equal(potetoNoteCopy('hardest-tasks', en.potetoPrefix), `Poteto 0.15 recommendation: ${OPUS}`)
    assert.equal(potetoNoteCopy('arena-runners', zh.potetoPrefix), `Poteto 0.15 推荐：${PANEL}`)
    assert.equal(potetoNoteCopy('how-critics', en.potetoPrefix), '')
    assert.equal(potetoNoteCopy('how-critics', zh.potetoPrefix), '')
    assert.equal(potetoNoteCopy('independent-verifier', en.potetoPrefix), '')
    assert.equal(potetoNoteCopy('poteto-agent', zh.potetoPrefix), '')
    assert.equal(potetoNoteCopy('comment-sicko', en.potetoPrefix), '')
  })
})

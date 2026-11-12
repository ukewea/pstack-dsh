import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { SystemPrompt, renderContextSnapshot } from '@deepseek-ai/dsh-system-prompt'
import { CHILD_SKILL_HINT_NAME, assemblyDepth, childSkillHint, childSkillHintText, watchChildSkillHint } from '../src/child-skill-hint.ts'
import { defaultSkillsRoot } from '../src/skills-provider.ts'

// Shape delegationDepthOf reads: options.subagentDepth and session.header.delegationDepth.
function agentAt(depth: number, runtimeDepth?: number): object {
  return {
    options: runtimeDepth === undefined ? {} : { subagentDepth: runtimeDepth },
    session: { header: { delegationDepth: depth } },
  }
}

describe('child skill hint', () => {
  it('names a poteto-mode path that exists in this package', async () => {
    const hint = childSkillHint()
    const path = join(defaultSkillsRoot(), 'poteto-mode', 'SKILL.md')
    assert.ok(hint.includes(path))
    await access(path)
    assert.match(hint, /`skill` tool cannot load/)
  })

  it('reads depth from the session header or the runtime options', () => {
    assert.equal(assemblyDepth({ scope: agentAt(0) }), 0)
    assert.equal(assemblyDepth({ scope: agentAt(1) }), 1)
    assert.equal(assemblyDepth({ scope: agentAt(0, 2) }), 2)
  })

  it('gives nothing to top-level agents and non-agent assemblies', () => {
    assert.equal(childSkillHintText({ scope: agentAt(0) }), '')
    assert.equal(childSkillHintText({}), '')
    assert.equal(childSkillHintText({ scope: {} }), '')
    assert.equal(childSkillHintText({ scope: { session: {} } }), '')
  })

  it('assembles into a child prompt and not into a top-level prompt', async () => {
    const ctx = new Context()
    ctx.plugin(SystemPrompt, {})
    watchChildSkillHint(ctx)
    await new Promise(resolve => setTimeout(resolve, 20))
    const prompt = ctx.get('systemPrompt') as SystemPrompt
    assert.ok(prompt !== undefined)
    const child = await prompt.assemble({ scope: agentAt(1) })
    assert.ok(child.contexts.some(entry => entry.name === CHILD_SKILL_HINT_NAME && entry.text.length > 0))
    assert.ok(renderContextSnapshot(child).includes(join(defaultSkillsRoot(), 'poteto-mode', 'SKILL.md')))
    const top = await prompt.assemble({ scope: agentAt(0) })
    assert.ok(!renderContextSnapshot(top).includes('poteto-mode'))
  })
})

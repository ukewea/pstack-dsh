import assert from 'node:assert/strict'
import { readFile, realpath } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { renderSkillContent } from '@deepseek-ai/dsh-skill'
import { openBundledSkills } from './support/bundled-skills.ts'

const root = fileURLToPath(new URL('../skills', import.meta.url))

// Upstream pstack sets disable-model-invocation on every skill except setup-pstack.
// The DSH skill tool refuses those skills, so poteto-mode reaches them by reading
// ../<name>/SKILL.md from the base directory DSH prints with its body.
describe('upstream invocation policy', () => {
  it('leaves only setup-pstack model-invocable and every skill user-invocable', async () => {
    const provider = openBundledSkills(root)
    try {
      const { skills } = await provider.snapshot()
      assert.deepEqual(skills.filter(skill => skill.invocation.modelInvocable).map(skill => skill.name), ['setup-pstack'])
      assert.deepEqual(skills.filter(skill => !skill.invocation.userInvocable).map(skill => skill.name), [])
      assert.equal(skills.filter(skill => skill.name.startsWith('principle-')).length, 24)
      assert.equal(await provider.get('make-bot-ui'), undefined)
    } finally {
      await provider.close()
    }
  })

  it('serves each leaf skill from ../<name>/SKILL.md beside poteto-mode', async () => {
    const provider = openBundledSkills(root)
    try {
      const mode = await provider.get('poteto-mode')
      assert.ok(mode)
      const base = /^Base directory for this skill: (.+)$/m.exec(renderSkillContent(mode))?.[1]
      assert.ok(base, 'poteto-mode is rendered with a base directory')
      const { skills } = await provider.snapshot()
      for (const summary of skills) {
        if (summary.name === 'poteto-mode') continue
        const leaf = resolve(base, '..', summary.name, 'SKILL.md')
        assert.ok(summary.path, summary.name)
        assert.equal(await realpath(leaf), await realpath(summary.path), summary.name)
        const body = (await provider.get(summary.name))?.content.trim() ?? ''
        assert.ok(body, summary.name)
        assert.ok((await readFile(leaf, 'utf8')).includes(body), summary.name)
      }
    } finally {
      await provider.close()
    }
  })

  it('resolves every skill and principle poteto-mode names', async () => {
    const provider = openBundledSkills(root)
    try {
      const mode = await provider.get('poteto-mode')
      assert.ok(mode)
      const base = /^Base directory for this skill: (.+)$/m.exec(renderSkillContent(mode))?.[1]
      assert.ok(base)
      const named = new Set([
        ...[...mode.content.matchAll(/\*\*([a-z0-9]+(?:-[a-z0-9]+)*)\*\* skill/g)].map(match => match[1]),
        ...mode.content.match(/principle-[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [],
      ])
      assert.ok(named.has('how') && named.has('principle-model-the-domain'), [...named].join(', '))
      for (const name of named) {
        const text = await readFile(resolve(base, '..', name, 'SKILL.md'), 'utf8').catch(() => '')
        assert.match(text, new RegExp(`^---\\nname: ${name}\\n`), `${name} is readable beside poteto-mode`)
      }
    } finally {
      await provider.close()
    }
  })
})

import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { openBundledSkills } from './support/bundled-skills.ts'

const root = fileURLToPath(new URL('../skills', import.meta.url))

describe('upstream 0.15 DSH skill availability', () => {
  it('discovers both new principles and loads their content through the provider', async () => {
    const provider = openBundledSkills(root)
    try {
      const { skills } = await provider.snapshot()
      for (const name of ['principle-attack-the-premise', 'principle-test-behavior-not-implementation']) {
        const listed = skills.find(skill => skill.name === name)
        assert.equal(listed?.invocation.modelInvocable, true, name)
        const loaded = await provider.get(name)
        assert.equal(loaded?.name, name)
        assert.equal(loaded?.invocation.modelInvocable, true)
        assert.ok(loaded?.content.includes(name === 'principle-attack-the-premise'
          ? 'Attack the Premise' : 'Test Behavior'))
      }
    } finally {
      await provider.close()
    }
  })

  it('keeps all principle and common workflow skills available to the model', async () => {
    const provider = openBundledSkills(root)
    try {
      const names = (await readdir(root)).filter(name => name.startsWith('principle-'))
      assert.equal(names.length, 24)
      for (const name of [...names, 'how', 'why', 'unslop', 'typescript-best-practices']) {
        const skill = await provider.get(name)
        assert.equal(skill?.invocation.modelInvocable, true, name)
      }
      assert.equal(await provider.get('make-bot-ui'), undefined)
    } finally {
      await provider.close()
    }
  })
})

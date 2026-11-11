import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { defaultSkillsRoot } from '../src/skills-provider.ts'
import { openBundledSkills } from './support/bundled-skills.ts'

const ROOT = defaultSkillsRoot()
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

async function skillDirs(root: string): Promise<string[]> {
  const names: string[] = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    try {
      await readFile(join(root, entry.name, 'SKILL.md'))
      names.push(entry.name)
    } catch {
      // Not a skill directory.
    }
  }
  return names.sort()
}

async function writeSkill(root: string, name: string, description: string, body: string): Promise<void> {
  await mkdir(join(root, name), { recursive: true })
  await writeFile(join(root, name, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\n${body}\n`)
}

async function waitFor<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs
  let last = await read()
  while (!accept(last)) {
    if (Date.now() > deadline) throw new Error(`timed out; last=${JSON.stringify(last)}`)
    await new Promise(resolve => setTimeout(resolve, 25))
    last = await read()
  }
  return last
}

describe('bundled skills through the official filesystem provider', () => {
  it('names every skill in kebab-case after its directory', async () => {
    // The official provider drops a skill whose frontmatter name is not kebab-case.
    for (const dir of await skillDirs(ROOT)) {
      const text = await readFile(join(ROOT, dir, 'SKILL.md'), 'utf8')
      const name = /^name:\s*(.+)$/m.exec(text)?.[1]?.trim()
      assert.equal(name, dir, `${dir}/SKILL.md name`)
      assert.match(dir, KEBAB)
    }
  })

  it('lists every bundled skill under the pstack-dsh provider', async () => {
    const skills = openBundledSkills()
    try {
      const snapshot = await skills.snapshot()
      assert.equal(snapshot.complete, true)
      assert.deepEqual(snapshot.skills.map(skill => skill.name).sort(), await skillDirs(ROOT))
      for (const skill of snapshot.skills) {
        assert.equal(skill.provider, 'pstack-dsh', skill.name)
        assert.equal(skill.source, 'bundled', skill.name)
      }
    } finally {
      await skills.close()
    }
  })

  it('decodes YAML-escaped quotes in descriptions', async () => {
    const skills = openBundledSkills()
    try {
      const snapshot = await skills.snapshot()
      const byName = new Map(snapshot.skills.map(skill => [skill.name, skill]))
      for (const name of ['automate-me', 'create-verification-skill', 'how', 'interrogate', 'maintain-verification-skill']) {
        const description = byName.get(name)?.description ?? ''
        assert.ok(description.includes('"'), `${name} keeps its quotes`)
        assert.ok(!description.includes('\\"'), `${name} has no literal backslash-quote`)
      }
      assert.match(byName.get('how')?.description ?? '', /^Use for "how does X work"/)
    } finally {
      await skills.close()
    }
  })

  it('keeps invocation flags and loads bodies', async () => {
    const skills = openBundledSkills()
    try {
      const mode = await skills.get('poteto-mode')
      assert.equal(mode?.invocation.modelInvocable, false)
      assert.equal(mode?.invocation.userInvocable, true)
      assert.match(mode?.content ?? '', /pstack_spawn/)
      const how = await skills.get('how')
      assert.equal(how?.invocation.modelInvocable, false)
      assert.equal(how?.invocation.userInvocable, true)
      assert.match(how?.content ?? '', /role: how-explorer/)
      const setup = await skills.get('setup-pstack')
      assert.equal(setup?.invocation.modelInvocable, true)
      assert.equal(setup?.invocation.userInvocable, true)
    } finally {
      await skills.close()
    }
  })

  it('mounts only the bundled root, not project or user skill roots', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pstack-bundled-'))
    const project = await mkdtemp(join(tmpdir(), 'pstack-project-'))
    await writeSkill(root, 'bundled-one', 'bundled', 'bundled body')
    await writeSkill(join(project, '.agents', 'skills'), 'project-one', 'project', 'project body')
    await writeSkill(join(project, '.dsh', 'skills'), 'project-two', 'project', 'project body')
    const skills = openBundledSkills(root, { cwd: project })
    try {
      const snapshot = await skills.snapshot()
      assert.deepEqual(snapshot.skills.map(skill => skill.name), ['bundled-one'])
    } finally {
      await skills.close()
    }
  })

  it('shows a skill added after the catalog was read', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pstack-late-skill-'))
    await writeSkill(root, 'skill-a', 'alpha', 'body a')
    const skills = openBundledSkills(root)
    try {
      assert.deepEqual((await skills.snapshot()).skills.map(skill => skill.name), ['skill-a'])
      // The provider's chokidar watcher ignores files that land before it reports ready.
      // Under a loaded parallel test run that takes longer, so let it settle first.
      await new Promise(resolve => setTimeout(resolve, 1000))
      await writeSkill(root, 'skill-b', 'beta', 'body b')
      const snapshot = await waitFor(() => skills.snapshot(), current => current.skills.length === 2, 15000)
      assert.deepEqual(snapshot.skills.map(skill => skill.name).sort(), ['skill-a', 'skill-b'])
      assert.equal((await skills.get('skill-b'))?.content, 'body b')
    } finally {
      await skills.close()
    }
  })
})

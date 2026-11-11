import { Context } from '@deepseek-ai/cordis'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import type { SkillCatalogSnapshot, SkillDefinition, SkillViewOptions } from '@deepseek-ai/dsh-skill'
import type { FileSystemSkillProvider } from '@deepseek-ai/dsh-skill-filesystem'
import { createSkillProvider, defaultSkillsRoot } from '../../src/skills-provider.ts'

export interface BundledSkills {
  snapshot(): Promise<SkillCatalogSnapshot>
  get(name: string): Promise<SkillDefinition | undefined>
  close(): Promise<void>
}

/** A real dsh-skill registry with only pstack's bundled provider registered. */
export function openBundledSkills(root = defaultSkillsRoot(), view: SkillViewOptions = { cwd: root }): BundledSkills {
  const ctx = new Context()
  new SkillRegistry(ctx)
  let provider: FileSystemSkillProvider | undefined
  const unregister = ctx.skills.registerProvider(control => {
    provider = createSkillProvider(ctx, control, root)
    return provider
  })
  return {
    snapshot: () => ctx.skills.snapshot(view),
    get: name => ctx.skills.get(name, view),
    async close() {
      unregister()
      await provider?.dispose()
    },
  }
}

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { SkillProviderControl } from '@deepseek-ai/dsh-skill'
import { FileSystemSkillProvider } from '@deepseek-ai/dsh-skill-filesystem'
import { SKILL_PROVIDER_NAME } from './ids.ts'

/** Bundled `skills/` beside `src/` and `lib/`. */
export function defaultSkillsRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'skills')
}

/**
 * Bundled pstack skills through the official filesystem provider. It parses
 * frontmatter as YAML, watches the root and invalidates through `control`, and
 * disposes its watchers when `control.signal` aborts. Only this root is mounted:
 * project and user skill roots stay with DSH's own `filesystem` provider.
 */
export function createSkillProvider(
  ctx: Context,
  control: SkillProviderControl,
  root = defaultSkillsRoot(),
): FileSystemSkillProvider {
  return new FileSystemSkillProvider(ctx, control, {
    providerName: SKILL_PROVIDER_NAME,
    includeDefaultRoots: false,
    bundledSkillDir: root,
  })
}

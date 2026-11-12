/**
 * Tell every subagent where pstack's bundled skills live.
 *
 * Upstream marks poteto-mode and the leaf skills manual-only, so the DSH
 * `skill` tool refuses them for a model. pstack_spawn already puts the
 * poteto-mode path in each child's prompt, but a child started another way
 * (the built-in `subagent` tool, Agent Teams, a parent falling back after a
 * pstack_spawn error) gets no path and then asks the `skill` tool, which
 * refuses. This context gives such children the path. Top-level agents get
 * nothing: there the user invokes the skills by slash command.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { delegationDepthOf } from '@deepseek-ai/dsh-subagent'
import type { AssembleContext } from '@deepseek-ai/dsh-system-prompt'
import { join } from 'node:path'
import { PLUGIN_ID } from './ids.ts'
import { defaultSkillsRoot } from './skills-provider.ts'

export const CHILD_SKILL_HINT_NAME = `${PLUGIN_ID}/child-skill-root`

export function childSkillHint(skillsRoot = defaultSkillsRoot()): string {
  return [
    `pstack skills: the \`skill\` tool cannot load pstack's bundled skills (poteto-mode, principle-*, and the rest); they are manual-only.`,
    `When your task names one, read its SKILL.md with the read tool instead: ${join(skillsRoot, '<name>', 'SKILL.md')}.`,
    `poteto-mode is at ${join(skillsRoot, 'poteto-mode', 'SKILL.md')}.`,
  ].join(' ')
}

/** Depth of the agent this assembly is for; 0 when the scope is not an agent. */
export function assemblyDepth(context: AssembleContext): number {
  const scope = context.scope
  if (typeof scope !== 'object' || scope === null || !('session' in scope)) return 0
  try {
    return delegationDepthOf(scope as Agent)
  } catch {
    return 0
  }
}

export function childSkillHintText(context: AssembleContext, skillsRoot = defaultSkillsRoot()): string {
  return assemblyDepth(context) > 0 ? childSkillHint(skillsRoot) : ''
}

export function watchChildSkillHint(ctx: Context): void {
  ctx.inject(['systemPrompt'], promptCtx => {
    const prompt = promptCtx.systemPrompt
    prompt.context({
      name: CHILD_SKILL_HINT_NAME,
      order: prompt.getContextOrder('SUBAGENT_DELEGATION') + 1,
      text: context => childSkillHintText(context),
      interpolate: false,
      required: true,
    })
  })
}

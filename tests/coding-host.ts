import type { Context } from '@deepseek-ai/cordis'
import LocalBashExecutor from '@deepseek-ai/dsh-bash-local'
import * as shellEnv from '@deepseek-ai/dsh-shell-env'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'

/** Host-plane services the Web app keeps outside presets. Tool rows inject these; they are not themselves tools. */
export async function mountCodingHostServices(ctx: Context): Promise<void> {
  await ctx.plugin(SkillRegistry)
  await ctx.plugin(LocalSubprocessRuntime)
  await ctx.plugin(LocalBashExecutor, {})
  await ctx.plugin(shellEnv)
}

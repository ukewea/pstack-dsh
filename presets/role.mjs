const WRITE_TOOLS = new Set(['write', 'edit', 'bash'])

export const inject = ['tools']

export function apply(ctx, config = {}) {
  if (config.restrictWrites === true) {
    ctx.tools.guard(execution => {
      if (!WRITE_TOOLS.has(execution.name)) return undefined
      return `pstack preset denies ${execution.name}`
    })
  }
}

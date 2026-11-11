import { defineTool } from '@deepseek-ai/dsh-tools'

export const inject = ['tools']

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'parent-only',
    description: 'Registered only on the parent preset.',
    parameters: {},
    output: {
      schema: { type: 'json' },
      render: () => [{ type: 'text', text: 'parent-only' }],
    },
    async execute() {
      return { ok: true }
    },
  }))
}

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Official DSH client build preset. It is not published to npm, so the build
// reads it from a deepseek-harness checkout at the tag this package targets.
const source = process.env.DSH_SOURCE?.trim()
if (!source) throw new Error('Set DSH_SOURCE to a deepseek-harness checkout; see TEST-PLAN.md "Build".')
const preset = resolve(source, 'packages/client/tsdown.client.ts')
if (!existsSync(preset)) throw new Error(`DSH client build preset not found: ${preset}`)
const { clientBundle } = await import(pathToFileURL(preset).href)

// Node half from src/index.ts (with lib/index.d.ts); browser half from src/client/index.ts.
export default clientBundle(import.meta.dirname, ['src/index.ts'], { lib: { dts: true } })

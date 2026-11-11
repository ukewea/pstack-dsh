import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('bundle composition', () => {
  it('is installable with stock dsh plugin add from git', async () => {
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      name: string
      version: string
      main: string
      scripts: Record<string, string>
      dsh: { bundle?: { patch?: string }; client: { platform: string; inject: string[] } }
    }
    assert.equal(pkg.name, 'pstack-dsh')
    assert.equal(pkg.dsh.bundle?.patch, './cordis.patch.yml')
    assert.equal(pkg.scripts.prepare, undefined)
    assert.equal(pkg.main, 'lib/index.js')
    const [host, client, readme, patch] = await Promise.all([
      readFile(join(root, 'lib/index.js'), 'utf8'),
      readFile(join(root, 'lib/client.js'), 'utf8'),
      readFile(join(root, 'README.md'), 'utf8'),
      readFile(join(root, 'cordis.patch.yml'), 'utf8'),
    ])
    assert.match(host, /function apply\(/)
    assert.match(host, /export \{[^}]*\bapply\b/)
    assert.match(client, /window\.__ModuleLoader__\.load/)
    assert.match(patch, /id:\s*pstack-dsh/)
    assert.match(patch, /name:\s*pstack-dsh/)
    assert.match(readme, /设置 → 插件 → 添加插件/)
    const tag = `v${pkg.version}`.replace(/\./g, '\\.')
    assert.match(readme, new RegExp(`github:aa2246740/pstack-dsh#${tag}`))
    assert.match(readme, new RegExp(`dsh plugin --profile web add github:aa2246740/pstack-dsh#${tag}`))
    assert.doesNotMatch(readme, /\bdshx\b|\bmy-plugins\b/i)
  })

  it('declares a web client half on settings.section, not a second config file', async () => {
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      name: string
      exports: Record<string, unknown>
      dsh: { client: { platform: string; inject: string[] } }
    }
    assert.equal(pkg.name, 'pstack-dsh')
    assert.equal(pkg.exports['./client'], './lib/client.js')
    assert.equal(pkg.dsh.client.platform, 'web')
    assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-settings'))
    assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-locale'))
  })

  it('registers settings.section id pstack from the client entry', async () => {
    const source = await readFile(join(root, 'src/client/index.ts'), 'utf8')
    assert.match(source, /export function apply/)
    assert.match(source, /export const inject = \['slots', 'locale', 'remote'\]/)
    assert.doesNotMatch(source, /export\s+default\s+/)
    assert.match(source, /settings\.section/)
    assert.match(source, /SETTINGS_SECTION_ID/)
  })
})

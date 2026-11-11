import type { PresetDefinition } from '@deepseek-ai/dsh-agent-preset-registry'

export const POTETO_PRESET_ID = 'pstack-poteto'
export const COMMENT_SICKO_PRESET_ID = 'pstack-comment-sicko'

/** Tool rows the Web host no longer mounts globally. An independent child preset does not inherit the parent preset, so these rows have to live here. */
export function developmentPlugins(): PresetDefinition['plugins'] {
  return [
    { id: 'agent-instructions', name: '@deepseek-ai/dsh-agent-instructions', config: { maxBytes: 65536 } },
    { id: 'tool-bash', name: '@deepseek-ai/dsh-tool-bash' },
    { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs', config: { applyPatch: false } },
    { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } },
    { id: 'skill-filesystem', name: '@deepseek-ai/dsh-skill-filesystem' },
    { id: 'tool-skill', name: '@deepseek-ai/dsh-tool-skill' },
  ]
}

export function rolePresetPlugins(restrictWrites: boolean): PresetDefinition['plugins'] {
  return [
    ...developmentPlugins(),
    { id: 'pstack-role', name: presetPluginUrl(), config: { restrictWrites } },
  ]
}

export interface RolePreset {
  readonly id: string
  readonly restrictsWrites: boolean
}

export function presetForRole(role: string): RolePreset {
  if (role === 'comment-sicko') return { id: COMMENT_SICKO_PRESET_ID, restrictsWrites: true }
  return { id: POTETO_PRESET_ID, restrictsWrites: false }
}

export function presetPluginUrl(): string {
  return new URL('../presets/role.mjs', import.meta.url).href
}

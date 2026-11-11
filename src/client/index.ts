/** Browser half: pstack roles inside official DSH Settings. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { PstackSettings } from './PstackSettings.tsx'
import type { PstackSettingsInjected } from './PstackSettings.tsx'
import { en, zh } from './locales.ts'
import type { PstackSettingsKey } from './locales.ts'
import { SETTINGS_SECTION_ID } from '../ids.ts'
import { listenForCatalogChanges } from './api.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.pstack': PstackSettingsKey
  }
}

export const name = 'pstack-dsh-client'
export const inject = ['slots', 'locale', 'remote']

export function apply(ctx: Context): void {
  const namespace = 'settings.pstack'
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'pstack-dsh: settings copy')
  const t: PstackSettingsInjected['t'] = ctx.locale.bind(namespace)
  const subscribeCatalogChanges: PstackSettingsInjected['subscribeCatalogChanges'] = listener =>
    listenForCatalogChanges(ctx, listener)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: SETTINGS_SECTION_ID,
    order: 16,
    label: () => t('nav'),
    inject: (): PstackSettingsInjected => ({ t, subscribeCatalogChanges }),
  }, PstackSettings))
}

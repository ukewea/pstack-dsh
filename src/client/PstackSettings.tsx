/** Plugin-owned pstack page inside the official Settings shell. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { LiveRoute } from '../catalog-types.ts'
import type { Overlay, OverlayRoute } from '../overlay-model.ts'
import { routeKey } from '../overlay-model.ts'
import {
  applyInheritAll,
  applyRouteToAll,
  draftToOverlay,
  liveFor,
  overlayToDraft,
  parseRouteSelectValue,
  routeSelectValue,
  selectableRoutes,
  stripIllegalEffort,
  type RoleDraft,
} from '../settings-draft.ts'
import { isRetiredRole, PANEL_ROLES, type PstackRole } from '../roles.ts'
import { loadSettingsSnapshot, saveSettingsOverlay } from './api.ts'
import type { PstackSettingsKey } from './locales.ts'
import { potetoNoteCopy } from './poteto-defaults.ts'

const STYLE_ID = 'pstack-dsh-settings-theme'

export interface PstackSettingsInjected {
  t: (key: PstackSettingsKey, params?: Record<string, unknown>) => string
  subscribeCatalogChanges: (listener: () => void) => () => void
}

export type PstackSettingsProps = Partial<PstackSettingsInjected>

const GROUPS: { id: 'groupPlaybooks' | 'groupSkills' | 'groupVerify' | 'groupPanels'; roles: readonly PstackRole[] }[] = [
  { id: 'groupPlaybooks', roles: ['feature', 'refactoring', 'bug-fix', 'perf-issue', 'hillclimb', 'judgment-and-prose'] },
  { id: 'groupSkills', roles: ['swarm-workers'] },
  { id: 'groupVerify', roles: ['independent-verifier', 'poteto-agent', 'comment-sicko'] },
  { id: 'groupPanels', roles: PANEL_ROLES.filter(role => !isRetiredRole(role)) },
]

const SETTINGS_CSS = `
.pstack-page { display:flex; flex-direction:column; gap:12px; max-width:720px; color:var(--dsw-alias-label-primary); }
.pstack-title { margin:0; font-size:16px; line-height:24px; font-weight:500; color:var(--dsw-alias-label-primary); }
.pstack-intro { margin:0; font-size:14px; line-height:22px; color:var(--dsw-alias-label-tertiary); }
.pstack-note { margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }
.pstack-warn { margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-state-warn-label); }
.pstack-error { margin:0; font-size:13px; line-height:20px; color:var(--dsw-alias-state-error-primary); }
.pstack-ok { margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-state-success-primary); }
.pstack-toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.pstack-group { margin:12px 0 0; display:flex; flex-direction:column; gap:8px; }
.pstack-group-title { margin:0; font-size:12px; line-height:18px; font-weight:500; color:var(--dsw-alias-label-secondary); }
.pstack-card {
  border:1px solid var(--dsw-alias-border-l2); border-radius:12px;
  padding:12px 14px; display:flex; flex-direction:column; gap:10px;
  background:var(--dsw-alias-bg-module-platform);
}
.pstack-card-head { display:flex; align-items:baseline; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.pstack-role { margin:0; font-size:13px; line-height:20px; font-weight:500; color:var(--dsw-alias-label-primary); font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.pstack-fields { display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; }
.pstack-field { display:flex; flex-direction:column; gap:4px; min-width:180px; flex:1; }
.pstack-label { font-size:12px; line-height:18px; color:var(--dsw-alias-label-secondary); }
.pstack-select {
  height:34px; padding:0 12px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px;
  background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary);
  font:inherit; font-size:13px; line-height:20px;
}
.pstack-select:focus-visible { outline:none; border-color:var(--dsw-alias-brand-primary); }
.pstack-select:disabled { color:var(--dsw-alias-label-tertiary); cursor:default; }
.pstack-row { display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; }
.pstack-path { margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); word-break:break-all; }
`

function ensureThemeStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = SETTINGS_CSS
  document.head.appendChild(style)
}

function overlaysEqual(left: Overlay, right: Overlay): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function RoleHead({ role, t }: { role: PstackRole; t: PstackSettingsInjected['t'] }) {
  return (
    <div className="pstack-card-head">
      <p className="pstack-role">{role}</p>
      <p className="pstack-note">{potetoNoteCopy(role, t('potetoPrefix'))}</p>
    </div>
  )
}

function firstSelectable(routes: readonly LiveRoute[]): OverlayRoute | undefined {
  const route = selectableRoutes(routes)[0]
  if (route === undefined) return undefined
  return { provider: route.provider, model: route.model }
}

function EffortSelect({
  id,
  route,
  live,
  t,
  onChange,
}: {
  id: string
  route: OverlayRoute
  live: readonly LiveRoute[]
  t: PstackSettingsInjected['t']
  onChange: (next: OverlayRoute) => void
}) {
  const found = liveFor(live, route.provider, route.model)
  if (found === undefined || found.efforts.length === 0) return null
  return (
    <div className="pstack-field">
      <label className="pstack-label" htmlFor={id}>{t('effort')}</label>
      <select
        id={id}
        className="pstack-select"
        value={route.reasoningEffort ?? ''}
        onChange={event => {
          const idValue = event.target.value
          onChange(idValue.length === 0
            ? { provider: route.provider, model: route.model }
            : { provider: route.provider, model: route.model, reasoningEffort: idValue })
        }}
      >
        <option value="">{t('effortOmit')}</option>
        {route.reasoningEffort !== undefined && !found.efforts.some(effort => effort.id === route.reasoningEffort)
          ? <option value={route.reasoningEffort} disabled>{route.reasoningEffort} · {t('unavailable')}</option>
          : null}
        {found.efforts.map(effort => (
          <option key={effort.id} value={effort.id}>{effort.name || effort.id}</option>
        ))}
      </select>
    </div>
  )
}

function RouteSelect({
  id,
  value,
  live,
  t,
  disabled,
  onChange,
}: {
  id: string
  value: string
  live: readonly LiveRoute[]
  t: PstackSettingsInjected['t']
  disabled: boolean
  onChange: (value: string) => void
}) {
  const selectable = selectableRoutes(live)
  return (
    <select id={id} className="pstack-select" value={value} disabled={disabled} onChange={event => { onChange(event.target.value) }}>
      <option value="inherit-parent">{t('inheritParent')}</option>
      <option value="auto">{t('auto')}</option>
      {value !== 'inherit-parent' && value !== 'auto' && !selectable.some(route => routeKey(route.provider, route.model) === value)
        ? <option value={value} disabled>{value.replace('::', '/')} · {t('unavailable')}</option>
        : null}
      {selectable.map(route => {
        const key = routeKey(route.provider, route.model)
        return (
          <option key={key} value={key}>
            {route.provider}/{route.model}
          </option>
        )
      })}
    </select>
  )
}

export function PstackSettings({ t, subscribeCatalogChanges }: PstackSettingsProps) {
  if (t === undefined) throw new Error('pstack settings requires its translation function')
  const [drafts, setDrafts] = useState<RoleDraft[] | undefined>(undefined)
  const [saved, setSaved] = useState<Overlay | undefined>(undefined)
  const [live, setLive] = useState<readonly LiveRoute[]>([])
  const [path, setPath] = useState<string>('')
  const [recommendOauth, setRecommendOauth] = useState(false)
  const [selectableCount, setSelectableCount] = useState(0)
  const [dropped, setDropped] = useState<string[]>([])
  const [error, setError] = useState<string | undefined>(undefined)
  const [catalogError, setCatalogError] = useState<string | undefined>(undefined)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const initialized = useRef(false)
  const catalogRequest = useRef<AbortController | undefined>(undefined)

  useEffect(() => { ensureThemeStyles() }, [])

  const refresh = useCallback(async () => {
    catalogRequest.current?.abort()
    const request = new AbortController()
    catalogRequest.current = request
    try {
      const snapshot = await loadSettingsSnapshot(request.signal)
      if (request.signal.aborted) return
      setLive(snapshot.catalog.routes)
      setSelectableCount(snapshot.catalog.selectableCount)
      setRecommendOauth(snapshot.catalog.recommendOauthLogin)
      setPath(snapshot.path)
      // Login/model notifications must never replace the user's in-progress
      // role choices (or the baseline used to decide whether Save is enabled).
      if (!initialized.current) {
        setSaved(snapshot.overlay)
        setDrafts(overlayToDraft(snapshot.overlay))
        setDropped(snapshot.droppedRoles)
        initialized.current = true
      }
      setCatalogError(undefined)
    } catch (caught: unknown) {
      if (!request.signal.aborted) {
        setCatalogError(caught instanceof Error ? caught.message : t('requestFailed'))
      }
    }
  }, [t])

  useEffect(() => {
    const reload = () => { void refresh() }
    const visible = () => { if (document.visibilityState === 'visible') reload() }
    const stop = subscribeCatalogChanges?.(reload)
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', visible)
    reload()
    return () => {
      stop?.()
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', visible)
      catalogRequest.current?.abort()
    }
  }, [refresh, subscribeCatalogChanges])

  const currentOverlay = useMemo(() => drafts === undefined ? undefined : draftToOverlay(drafts), [drafts])
  const dirty = saved !== undefined && currentOverlay !== undefined && !overlaysEqual(saved, currentOverlay)
  const empty = selectableCount === 0
  const applyTargets = selectableRoutes(live)

  const patchRole = (role: PstackRole, update: (draft: RoleDraft) => RoleDraft): void => {
    setDrafts(current => current?.map(draft => draft.role === role ? update(draft) : draft))
    setNotice(undefined)
  }

  const setScalarChoice = (role: PstackRole, value: string): void => {
    const parsed = parseRouteSelectValue(value, live)
    patchRole(role, draft => {
      if (parsed.inherit) {
        return { ...draft, inherit: true, inheritChoice: parsed.inheritChoice, routes: [] }
      }
      return { ...draft, inherit: false, inheritChoice: 'inherit-parent', routes: [stripIllegalEffort(parsed.route, live)] }
    })
  }

  const setPanelChoice = (role: PstackRole, index: number, value: string): void => {
    const parsed = parseRouteSelectValue(value, live)
    patchRole(role, draft => {
      if (parsed.inherit) {
        return { ...draft, inherit: true, inheritChoice: parsed.inheritChoice, routes: [] }
      }
      const routes = draft.inherit ? [] : [...draft.routes]
      routes[index] = stripIllegalEffort(parsed.route, live)
      return { ...draft, inherit: false, inheritChoice: 'inherit-parent', routes }
    })
  }

  const save = async (): Promise<void> => {
    if (currentOverlay === undefined) return
    setBusy(true)
    setNotice(undefined)
    setError(undefined)
    try {
      const result = await saveSettingsOverlay(currentOverlay)
      setSaved(result.overlay)
      setDrafts(overlayToDraft(result.overlay))
      setDropped([])
      setError(undefined)
      setNotice(t('saved'))
    } catch (caught: unknown) {
      setNotice(undefined)
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="pstack-page"
      aria-labelledby="pstack-settings-title"
      onFocusCapture={event => { if (event.target instanceof HTMLSelectElement) void refresh() }}
      onPointerDownCapture={event => { if (event.target instanceof HTMLSelectElement) void refresh() }}
    >
      <h2 id="pstack-settings-title" className="pstack-title">{t('title')}</h2>
      <p className="pstack-intro">{t('intro')}</p>
      <p className="pstack-note">{t('catalogUpdates')}</p>
      {error !== undefined ? <p className="pstack-error">{error}</p> : null}
      {catalogError !== undefined ? <p className="pstack-error">{catalogError}</p> : null}
      {notice !== undefined ? <p className="pstack-ok" role="status">{notice}</p> : null}
      {dropped.length > 0 ? <p className="pstack-warn">{t('dropped')}</p> : null}
      {drafts === undefined
        ? <p className="pstack-note">{t('loading')}</p>
        : (
            <>
              {empty ? <p className="pstack-warn">{t('emptyCatalog')}</p> : null}
              {recommendOauth ? <p className="pstack-note">{t('oauthRecommend')}</p> : null}
              <div className="pstack-toolbar">
                <Button variant="primary" size="sm" disabled={busy || !dirty} onClick={() => { void save() }}>
                  {busy ? t('saving') : t('save')}
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => { void refresh() }}>
                  {t('reload')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setDrafts(current => current === undefined ? current : applyInheritAll(current))
                    setNotice(undefined)
                  }}
                >
                  {t('resetAll')}
                </Button>
                {applyTargets.length > 0
                  ? (
                      <label className="pstack-field" style={{ minWidth: 220 }}>
                        <span className="pstack-label">{t('applyAll')}</span>
                        <select
                          className="pstack-select"
                          defaultValue=""
                          disabled={busy}
                          onChange={event => {
                            const value = event.target.value
                            event.target.value = ''
                            if (value.length === 0) return
                            if (value === 'inherit-parent') {
                              setDrafts(current => current === undefined ? current : applyInheritAll(current))
                              return
                            }
                            const parsed = parseRouteSelectValue(value, live)
                            if (parsed.inherit) {
                              setDrafts(current => current === undefined ? current : applyInheritAll(current, parsed.inheritChoice))
                              return
                            }
                            setDrafts(current => current === undefined ? current : applyRouteToAll(current, parsed.route, live))
                          }}
                        >
                          <option value="">{t('applyAll')}</option>
                          <option value="inherit-parent">{t('applyAllInherit')}</option>
                          {applyTargets.map(route => {
                            const key = routeKey(route.provider, route.model)
                            return <option key={key} value={key}>{route.provider}/{route.model}</option>
                          })}
                        </select>
                      </label>
                    )
                  : null}
              </div>
              {GROUPS.map(group => (
                <div key={group.id} className="pstack-group">
                  <h3 className="pstack-group-title">{t(group.id)}</h3>
                  {group.roles.map(role => {
                    const draft = drafts.find(entry => entry.role === role)
                    if (draft === undefined) return null
                    if (!draft.panel) {
                      const route = draft.routes[0]
                      return (
                        <article key={role} className="pstack-card">
                          <RoleHead role={role} t={t} />
                          <div className="pstack-fields">
                            <div className="pstack-field">
                              <label className="pstack-label" htmlFor={`pstack-role-${role}`}>{role}</label>
                              <RouteSelect
                                id={`pstack-role-${role}`}
                                value={routeSelectValue(draft)}
                                live={live}
                                t={t}
                                disabled={busy}
                                onChange={value => { setScalarChoice(role, value) }}
                              />
                            </div>
                            {route !== undefined && !draft.inherit
                              ? (
                                  <EffortSelect
                                    id={`pstack-effort-${role}`}
                                    route={route}
                                    live={live}
                                    t={t}
                                    onChange={next => {
                                      patchRole(role, current => ({ ...current, routes: [next] }))
                                    }}
                                  />
                                )
                              : null}
                          </div>
                        </article>
                      )
                    }
                    const rows = draft.inherit ? [] : draft.routes
                    return (
                      <article key={role} className="pstack-card">
                        <RoleHead role={role} t={t} />
                        {draft.inherit
                          ? (
                              <div className="pstack-field">
                                <label className="pstack-label" htmlFor={`pstack-role-${role}`}>{t('inheritParent')}</label>
                                <RouteSelect
                                  id={`pstack-role-${role}`}
                                  value={draft.inheritChoice}
                                  live={[]}
                                  t={t}
                                  disabled={busy}
                                  onChange={value => {
                                    if (value === 'inherit-parent' || value === 'auto') {
                                      patchRole(role, current => ({
                                        ...current,
                                        inherit: true,
                                        inheritChoice: value,
                                        routes: [],
                                      }))
                                    }
                                  }}
                                />
                              </div>
                            )
                          : (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => {
                                  patchRole(role, current => ({
                                    ...current,
                                    inherit: true,
                                    inheritChoice: 'inherit-parent',
                                    routes: [],
                                  }))
                                }}
                              >
                                {t('inheritParent')}
                              </Button>
                            )}
                        {!draft.inherit
                          ? rows.map((route, index) => (
                              <div key={`${role}-${index}`} className="pstack-row">
                                <div className="pstack-field">
                                  <label className="pstack-label" htmlFor={`pstack-panel-${role}-${index}`}>{`${role}[${index}]`}</label>
                                  <RouteSelect
                                    id={`pstack-panel-${role}-${index}`}
                                    value={routeSelectValue({ ...draft, inherit: false, routes: [route] })}
                                    live={live}
                                    t={t}
                                    disabled={busy || empty}
                                    onChange={value => { setPanelChoice(role, index, value) }}
                                  />
                                </div>
                                <EffortSelect
                                  id={`pstack-panel-effort-${role}-${index}`}
                                  route={route}
                                  live={live}
                                  t={t}
                                  onChange={next => {
                                    patchRole(role, current => {
                                      const nextRoutes = [...current.routes]
                                      nextRoutes[index] = next
                                      return { ...current, inherit: false, routes: nextRoutes }
                                    })
                                  }}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => {
                                    patchRole(role, current => {
                                      const nextRoutes = current.routes.filter((_, item) => item !== index)
                                      return nextRoutes.length === 0
                                        ? { ...current, inherit: true, routes: [] }
                                        : { ...current, inherit: false, routes: nextRoutes }
                                    })
                                  }}
                                >
                                  {t('removeRoute')}
                                </Button>
                              </div>
                            ))
                          : null}
                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy || empty}
                            onClick={() => {
                              const added = firstSelectable(live)
                              if (added === undefined) return
                              patchRole(role, current => ({
                                ...current,
                                inherit: false,
                                routes: [...(current.inherit ? [] : current.routes), added],
                              }))
                            }}
                          >
                            {t('addRoute')}
                          </Button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              ))}
              {path.length > 0 ? <p className="pstack-path">{t('overlayPath')}: {path}</p> : null}
            </>
          )}
    </section>
  )
}

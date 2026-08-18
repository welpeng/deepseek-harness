// @vitest-environment jsdom
/**
 * REAL-composition coverage: a test-only cordis.yml booted through the
 * vendored Loader mounts the actual slot service and layout plugin beside a
 * third-party Activity contributor. Assertions observe the user-visible
 * Activity label, keyed surface registration, selection, and HMR teardown.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { createElement, useSyncExternalStore } from 'react'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import { SidebarRoot } from '../../ui-sidebar/src/client/SidebarRoot.tsx'
import * as Layout from '../src/client/index.ts'

const SLOTS = 'test:slots'
const THEME = 'test:theme'
const LAYOUT = '@deepseek-ai/dsh-client-ui-layout'
const SESSIONS = 'test:sessions-activity'
const ISSUES = 'test:issues-activity'

const themeSnapshot: ThemeSnapshot = Object.freeze({
  preference: 'light',
  active: Object.freeze({ id: 'light', colorScheme: 'light', tokens: Object.freeze({}) }),
  themes: Object.freeze([]),
  revision: 0,
})

const slotsModule = {
  apply(ctx: Context): void { ctx.plugin(SlotRegistry) },
}

const themeModule = {
  apply(ctx: Context): void {
    ctx.effect(() => ctx.reflect.provide('theme', { getTheme: () => themeSnapshot }))
  },
}

const issuesModule = {
  inject: ['activities', 'slots'],
  apply(ctx: Context): void {
    ctx.effect(() => ctx.activities.register({ id: 'issues', label: () => 'Issues', order: 20 }))
    ctx.slots.inject('activity.main', () => ctx.slots.register(
      { name: 'activity.main', key: 'issues' },
      () => 'Issue board',
    ))
  },
}

const sessionsModule = {
  inject: ['activities'],
  apply(ctx: Context): void {
    ctx.effect(() => ctx.activities.register({ id: 'sessions', label: () => 'Sessions', order: 0 }))
  },
}

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  cleanup()
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

async function loadComposition(): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-activity-composition-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [SLOTS, THEME, LAYOUT, SESSIONS, ISSUES]
    .map(name => `- name: '${name}'`)
    .join('\n') + '\n')
  context = new Context()
  context.baseUrl = pathToFileURL(root).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    [SLOTS, slotsModule],
    [THEME, themeModule],
    [LAYOUT, Layout],
    [SESSIONS, sessionsModule],
    [ISSUES, issuesModule],
  ])
  context.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof context.loader.internal>
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await context.loader.await()
  return context
}

describe('Activity real Loader composition', () => {
  it('publishes and removes a third-party top-level surface through one plugin lifetime', async () => {
    const ctx = await loadComposition()

    expect(ctx.activities.getSnapshot().items.map(item => item.label())).toEqual(['Sessions', 'Issues'])
    expect(ctx.slots.entriesOfSlot('activity.main').map(entry => entry.options.key)).toEqual(['issues'])
    const useActivities = <S>(selector: (snapshot: ReturnType<typeof ctx.activities.getSnapshot>) => S): S =>
      selector(useSyncExternalStore(ctx.activities.subscribe, ctx.activities.getSnapshot))
    const view = render(createElement(SidebarRoot, {
      collapsed: false,
      width: 280,
      startSession: () => undefined,
      toggleSidebar: () => undefined,
      useActivities,
      defaultActivityId: ctx.activities.defaultId,
      selectActivity: (id: string) => { ctx.activities.select(id) },
      t: (key: string) => key,
      renderSlot: () => null,
    } as never))
    expect(view.getByRole('tab', { name: 'Issues' })).not.toBeNull()
    ctx.activities.select('issues')
    expect(ctx.activities.getSnapshot().activeId).toBe('issues')

    const contributor = [...ctx.loader.entries()].find(entry => entry.options.name === ISSUES)!
    await contributor.fiber!.dispose()
    expect(ctx.activities.getSnapshot()).toMatchObject({ activeId: 'sessions' })
    expect(ctx.activities.getSnapshot().items.map(item => item.id)).toEqual(['sessions'])
    expect(ctx.slots.entriesOfSlot('activity.main')).toEqual([])
    await waitFor(() => { expect(view.queryByRole('tab', { name: 'Issues' })).toBeNull() })
  })
})

import { describe, expect, it, vi } from 'vitest'
import {
  ActivityRegistry, DEFAULT_ACTIVITY_ID,
} from '@deepseek-ai/dsh-client-ui-layout/src/client/activity.ts'

describe('ActivityRegistry', () => {
  it('publishes an ordered immutable directory and switches selection', () => {
    const registry = new ActivityRegistry()
    const changed = vi.fn()
    registry.subscribe(changed)
    registry.register({ id: DEFAULT_ACTIVITY_ID, order: 0, label: () => 'Sessions' })
    registry.register({ id: 'issues', order: 20, label: () => 'Issues', shortLabel: () => 'I' })

    expect(registry.getSnapshot().items.map(item => item.id)).toEqual(['sessions', 'issues'])
    expect(registry.getSnapshot().activeId).toBe('sessions')
    registry.select('issues')
    expect(registry.getSnapshot().activeId).toBe('issues')
    expect(changed).toHaveBeenCalledTimes(3)
    expect(Object.isFrozen(registry.getSnapshot())).toBe(true)
    expect(Object.isFrozen(registry.getSnapshot().items)).toBe(true)
    expect(Object.isFrozen(registry.getSnapshot().items[0])).toBe(true)
  })

  it('falls back to Sessions when the selected contribution unloads', () => {
    const registry = new ActivityRegistry()
    registry.register({ id: DEFAULT_ACTIVITY_ID, label: () => 'Sessions' })
    const dispose = registry.register({ id: 'issues', label: () => 'Issues' })
    registry.select('issues')
    dispose()
    dispose()
    expect(registry.getSnapshot().activeId).toBe(DEFAULT_ACTIVITY_ID)
    expect(registry.getSnapshot().items.map(item => item.id)).toEqual(['sessions'])
  })

  it('rejects malformed, duplicate, and unknown ids', () => {
    const registry = new ActivityRegistry()
    expect(() => registry.register({ id: ' issues', label: () => 'Issues' })).toThrow(/trimmed/)
    registry.register({ id: 'issues', label: () => 'Issues' })
    expect(() => registry.register({ id: 'issues', label: () => 'Other' })).toThrow(/already registered/)
    expect(() => { registry.select('missing') }).toThrow(/not registered/)
  })

  it('uses the first ordered Activity when Sessions is absent', () => {
    const registry = new ActivityRegistry()
    const disposeIssues = registry.register({ id: 'issues', order: 20, label: () => 'Issues' })
    registry.register({ id: 'reports', order: 10, label: () => 'Reports' })
    registry.select('issues')
    disposeIssues()
    expect(registry.getSnapshot().activeId).toBe('reports')
  })
})

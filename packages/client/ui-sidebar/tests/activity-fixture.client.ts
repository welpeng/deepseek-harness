import type {
  ActivityDescriptor, ActivitySnapshot, IActivityRegistry,
} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import { useSyncExternalStore } from 'react'

/**
 * Minimal observable Activity directory for client-side sidebar component tests.
 * @returns A registry-compatible test double with deterministic insertion order.
 */
export function createTestActivities(): IActivityRegistry {
  const defaultId = 'sessions'
  const entries = new Map<string, ActivityDescriptor>()
  const listeners = new Set<() => void>()
  let activeId = defaultId
  let snapshot: ActivitySnapshot = Object.freeze({ activeId, items: Object.freeze([]) })

  const publish = (): void => {
    snapshot = Object.freeze({ activeId, items: Object.freeze([...entries.values()]) })
    for (const listener of [...listeners]) listener()
  }

  return {
    defaultId,
    register(descriptor) {
      entries.set(descriptor.id, descriptor)
      publish()
      return () => {
        entries.delete(descriptor.id)
        if (activeId === descriptor.id) activeId = defaultId
        publish()
      }
    },
    select(id) {
      if (!entries.has(id)) throw new Error(`activity "${id}" is not registered`)
      activeId = id
      publish()
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

/**
 * Bind a test registry through the same selector-hook interface the renderer supplies.
 * @param activities - Test Activity directory.
 * @returns A React selector hook for component props.
 */
export function bindTestActivities(
  activities: IActivityRegistry,
): SnapshotSelectorHook<ActivitySnapshot> {
  return selector => selector(useSyncExternalStore(
    activities.subscribe,
    activities.getSnapshot,
  ))
}

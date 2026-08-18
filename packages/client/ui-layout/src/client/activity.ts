/**
 * React-free directory of top-level application Activities. Activities are
 * global surfaces beside the built-in Session surface: a registrant owns one
 * stable id and contributes its UI through the keyed Activity slots. The
 * directory owns only navigation metadata and the current selection; the slot
 * renderer binds its immutable snapshot to selector hooks.
 */
import type {
  HostObservable, SnapshotSelectorHook,
} from '@deepseek-ai/dsh-client-ui-slots'

/** The shipped Session/Workspace surface and the selection fallback. */
export const DEFAULT_ACTIVITY_ID = 'sessions'

/** One top-level application surface advertised in the shell navigation. */
export interface ActivityDescriptor {
  /** Stable dispatch key shared by the Activity's sidebar and main entries. */
  id: string
  /** Active-locale label resolver; callers normally close over ctx.locale.bind(). */
  label: () => string
  /** Optional compact label resolver for the collapsed navigation rail. */
  shortLabel?: () => string
  /** Ascending shell-navigation order (ties retain registration order). */
  order?: number
}

/** Immutable Activity selection and ordered directory. */
export interface ActivitySnapshot {
  /** Currently selected Activity id. The default remains valid during boot. */
  activeId: string
  /** Registered Activities in navigation order. */
  items: readonly ActivityDescriptor[]
}

/** Cross-plugin Activity navigation face provided as ctx.activities. */
export interface IActivityRegistry {
  /** Stable id of the resident Session/Workspace Activity. */
  readonly defaultId: string
  /**
   * Register one Activity for the caller's plugin lifetime.
   * @param descriptor - Stable navigation metadata owned by the registrant.
   * @returns An idempotent disposer for the contribution.
   */
  register(descriptor: ActivityDescriptor): () => void
  /**
   * Select a registered Activity.
   * @param id - Id of an existing contribution.
   */
  select(id: string): void
  /**
   * Read the cached immutable snapshot.
   * @returns The current selection and ordered directory.
   */
  getSnapshot: () => ActivitySnapshot
  /**
   * Observe directory or selection changes.
   * @param listener - Callback invoked after a published change.
   * @returns A disposer for the subscription.
   */
  subscribe: (listener: () => void) => () => void
}

/** Raw Activity viewing face returned by a slot inject factory. */
export interface ActivityViewInjected {
  hooks: {
    /** React-free observable Activity directory and selection. */
    activities: HostObservable<ActivitySnapshot>
  }
  /** Stable id of the resident Session/Workspace Activity. */
  defaultActivityId: string
}

/** Component-side Activity selector hook bound by the slot renderer. */
export interface ActivityViewHooks {
  /** Select a value from the current Activity snapshot. */
  useActivities: SnapshotSelectorHook<ActivitySnapshot>
}

type StoredActivity = ActivityDescriptor & { sequence: number }

/** Runtime implementation behind {@link IActivityRegistry}. */
export class ActivityRegistry implements IActivityRegistry {
  /** Stable id of the resident Session/Workspace Activity. */
  readonly defaultId = DEFAULT_ACTIVITY_ID
  private readonly entries = new Map<string, StoredActivity>()
  private readonly listeners = new Set<() => void>()
  private activeId = DEFAULT_ACTIVITY_ID
  private sequence = 0
  private snapshot: ActivitySnapshot = Object.freeze({
    activeId: DEFAULT_ACTIVITY_ID,
    items: Object.freeze([]),
  })

  /**
   * Register one Activity; duplicate ids are a composition error.
   * @param descriptor - Stable navigation metadata owned by the registrant.
   * @returns An idempotent disposer for the contribution.
   */
  register(descriptor: ActivityDescriptor): () => void {
    const id = descriptor.id.trim()
    if (id.length === 0 || id !== descriptor.id) {
      throw new Error('activity id must be a non-empty trimmed string')
    }
    if (this.entries.has(id)) throw new Error(`activity "${id}" is already registered`)
    const stored: StoredActivity = Object.freeze({ ...descriptor, id, sequence: this.sequence++ })
    this.entries.set(id, stored)
    this.publish()
    let disposed = false
    return () => {
      if (disposed) return
      disposed = true
      if (this.entries.get(id) !== stored) return
      this.entries.delete(id)
      if (this.activeId === id) this.activeId = this.fallbackId()
      this.publish()
    }
  }

  /**
   * Select a registered Activity; unknown ids fail loud.
   * @param id - Id of an existing contribution.
   */
  select(id: string): void {
    if (!this.entries.has(id)) throw new Error(`activity "${id}" is not registered`)
    if (this.activeId === id) return
    this.activeId = id
    this.publish()
  }

  /** @returns The cached immutable snapshot. */
  getSnapshot = (): ActivitySnapshot => this.snapshot

  /**
   * Subscribe to Activity changes.
   * @param listener - Callback invoked after a published change.
   * @returns A disposer for the subscription.
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private fallbackId(): string {
    if (this.entries.has(DEFAULT_ACTIVITY_ID)) return DEFAULT_ACTIVITY_ID
    return this.sorted()[0]?.id ?? DEFAULT_ACTIVITY_ID
  }

  private sorted(): StoredActivity[] {
    return [...this.entries.values()].sort((left, right) =>
      (left.order ?? 0) - (right.order ?? 0) || left.sequence - right.sequence)
  }

  private publish(): void {
    this.snapshot = Object.freeze({
      activeId: this.activeId,
      items: Object.freeze(this.sorted().map(({ sequence: _sequence, ...descriptor }) =>
        Object.freeze(descriptor))),
    })
    for (const listener of [...this.listeners]) listener()
  }
}

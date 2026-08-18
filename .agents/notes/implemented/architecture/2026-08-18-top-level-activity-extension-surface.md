# Agent Note: Top-level Activity extension surface

Status: implemented

English | [中文](2026-08-18-top-level-activity-extension-surface.zh.md)

## Problem

The web shell exposed one top-level product surface: Sessions organized beneath Workspace rows. A plugin whose domain spans repositories, such as an issue board or operations inbox, could only pretend to belong to one Workspace, replace the entire root frame, or add feature-specific navigation to the sidebar package. The first choice corrupts the domain model, the second removes the resident conversation composition, and the third makes every new product surface a shell edit.

The existing slot system could compose content after a parent declared a seat, but it did not own global navigation identity or selection. A top-level extension therefore needed one small directory for discoverability and two keyed rendering seats, without turning React component imports into the plugin protocol.

## Decision

`@deepseek-ai/dsh-client-ui-layout` owns the React-free `ctx.activities` service. An Activity descriptor contains a stable `id`, a live locale-following `label()` resolver, an optional compact label, and an optional order. The service owns the current selection and an immutable observable snapshot; duplicate, blank, or unknown ids fail loud, and removing the selected contribution falls back to the built-in `sessions` id or the first remaining Activity.

The root frame declares keyed `activity.main`. `@deepseek-ai/dsh-client-ui-sidebar` declares keyed `sidebar.activity`, registers the built-in Sessions descriptor, and shows Activity navigation only when at least two descriptors are composed. A feature plugin joins the surface by registering one descriptor and contributing entries under the same key to the two slots. Collaboration travels through `ctx.activities` and `ctx.slots`; the shell never imports the feature's component or business service.

Sessions remain the resident default. Selecting another Activity hides the conversation subtree without unmounting it, dispatches the selected `activity.main` entry, and derives a zero details-column width without changing the stored panel preference. Returning to Sessions therefore preserves conversation identity and the prior details preference. The selected Activity's sidebar replaces only the Session/Workspace browsing region; the wordmark, Activity navigation, collapse control, and Settings seat remain shell-owned.

Registrations use Cordis effects and declaration-aware slot injection. Unloading an Activity removes its descriptor and keyed entries together, selection falls back synchronously, and reloading can register the same id without stale chrome or static activation-order dependencies. This decision extends the [slot type-chain implementation](2026-07-22-slot-type-chain-implementation.md) and the [GUI web client architecture](2026-07-19-gui-web-client-architecture.md); neither note is superseded because their slot ownership and package boundaries remain unchanged.

## Alternatives considered

**Treat every board as a special Workspace.** Rejected because cross-repository tasks, account-wide inboxes, and operational views do not have one filesystem root. A fake Workspace would leak UI navigation into business identity and make source items choose an arbitrary code directory.

**Let each plugin add an independent top-level sidebar button.** Rejected because button contributions would not define selection fallback, main-surface dispatch, resident Session behavior, ordering, or HMR teardown as one contract. Every consumer would reconstruct part of the state machine.

**Register complete replacement roots.** Rejected because `root` is a single exclusive shell seat. Replacing it discards the layout, Settings, conversation identity, and every nested declaration rather than adding one application domain.

**Store Activity selection in the host or browser persistence.** Deferred because selection is viewing state and the initial contract needs no cross-device or restart semantics. Individual Activities continue to own durable filters and domain data.

## Consequences

Optional plugins can now add first-class application domains beside Sessions while remaining independently unloadable. The navigation directory carries metadata only; a complete Activity must contribute matching main and sidebar entries and own its data, loading, mutation, and error lifecycle.

The layout and sidebar packages gain one shared service dependency but no feature dependency. With no optional Activity composed, the shipped page keeps its prior single-surface appearance because the Activity switcher stays hidden.

Unit tests pin registry ordering, selection, fallback, duplicate rejection, AppFrame residency, sidebar dispatch, and collapsed behavior. A real vendored-Loader composition boots the actual slot service and layout package with a third-party test Activity, observes the visible `Issues` label and keyed main entry, selects it, and then verifies that disposing the contributor removes both outcomes and restores the Sessions fallback.

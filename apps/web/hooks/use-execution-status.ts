import { useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// Module-level state — survives navigations, shared across components.
// ---------------------------------------------------------------------------

const executingIds = new Set<string>();
const listeners = new Set<() => void>();

/**
 * A frozen snapshot of the executing set, recreated on each mutation so that
 * `useSyncExternalStore`'s `Object.is` identity check works correctly.
 */
let frozenSnapshot: ReadonlySet<string> = Object.freeze(new Set<string>());

function emitChange() {
  frozenSnapshot = Object.freeze(new Set(executingIds));
  for (const listener of listeners) {
    listener();
  }
}

// ---------------------------------------------------------------------------
// Actions (imperative, not hooks)
// ---------------------------------------------------------------------------

/** Mark an ID as currently executing. */
export function addExecuting(id: string) {
  if (executingIds.has(id)) return;
  executingIds.add(id);
  emitChange();
}

/** Remove an ID from the executing set. */
export function removeExecuting(id: string) {
  if (!executingIds.has(id)) return;
  executingIds.delete(id);
  emitChange();
}

/** Remove all entries. Useful for testing and edge-case cleanup. */
export function clearAllExecuting() {
  if (executingIds.size === 0) return;
  executingIds.clear();
  emitChange();
}

/** Synchronous check — useful outside React. */
export function isExecuting(id: string): boolean {
  return executingIds.has(id);
}

// ---------------------------------------------------------------------------
// useSyncExternalStore bindings
// ---------------------------------------------------------------------------

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ReadonlySet<string> {
  return frozenSnapshot;
}

const EMPTY_SET: ReadonlySet<string> = Object.freeze(new Set<string>());
function getServerSnapshot(): ReadonlySet<string> {
  return EMPTY_SET;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Returns `true` while the given `id` is marked as executing.
 * Uses `useSyncExternalStore` so components re-render exactly when the
 * executing set changes.
 */
export function useIsExecuting(id: string): boolean {
  const set = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return set.has(id);
}

/**
 * Returns the full optimistic executing set.
 * Useful when rendering lists where each item needs to react to global
 * execution state changes.
 */
export function useExecutingIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

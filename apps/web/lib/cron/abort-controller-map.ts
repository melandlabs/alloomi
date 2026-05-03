/**
 * Global map to track AbortControllers for running job executions.
 * This allows stopping a character execution by its executionId.
 *
 * Uses global object to survive HMR in development and share state
 * within the same Node.js process.
 */

import { EventEmitter } from "node:events";

// Use global to survive HMR and share within same process
declare global {
  // eslint-disable-next-line no-shadow
  var executionAbortControllers: Map<string, AbortController> | undefined;
  // eslint-disable-next-line no-shadow
  var executionCharacterIds: Map<string, string> | undefined;
  // eslint-disable-next-line no-shadow
  var abortEmitter: EventEmitter | undefined;
}

// Initialize if not exists
if (!global.executionAbortControllers) {
  global.executionAbortControllers = new Map();
}
if (!global.executionCharacterIds) {
  global.executionCharacterIds = new Map();
}
if (!global.abortEmitter) {
  global.abortEmitter = new EventEmitter();
  global.abortEmitter.setMaxListeners(1000);
}

export function registerAbortController(
  executionId: string,
  controller: AbortController,
  characterId?: string,
): void {
  global.executionAbortControllers?.set(executionId, controller);
  if (characterId) {
    global.executionCharacterIds?.set(executionId, characterId);
  }
}

export function unregisterAbortController(executionId: string): void {
  global.executionAbortControllers?.delete(executionId);
  global.executionCharacterIds?.delete(executionId);
}

export function getAbortController(
  executionId: string,
): AbortController | undefined {
  return global.executionAbortControllers?.get(executionId);
}

export function getCharacterIdByExecutionId(
  executionId: string,
): string | undefined {
  return global.executionCharacterIds?.get(executionId);
}

/**
 * Stop an execution by its ID.
 * Returns true if the abort was triggered, false if not found.
 * @param reason - Optional reason for aborting (e.g., "user_stopped")
 */
export function stopExecution(executionId: string, reason?: string): boolean {
  const controller = global.executionAbortControllers?.get(executionId);
  if (controller) {
    controller.abort(reason);
    // Also emit an event for listeners
    global.abortEmitter?.emit(`abort:${executionId}`);
    return true;
  }
  return false;
}

/**
 * Subscribe to abort events for a specific execution.
 * Returns a cleanup function to unsubscribe.
 */
export function onAbort(executionId: string, callback: () => void): () => void {
  global.abortEmitter?.on(`abort:${executionId}`, callback);
  return () => {
    global.abortEmitter?.off(`abort:${executionId}`, callback);
  };
}

/**
 * Check if an execution is currently registered.
 */
export function isExecutionRegistered(executionId: string): boolean {
  return global.executionAbortControllers?.has(executionId) ?? false;
}

/**
 * syncStateMachine.ts - Explicit sync-status state machine.
 * Enforces:
 *   pending -> syncing -> synced (success path)
 *   pending -> syncing -> failed -> retryable (failure path)
 */

export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'synced' | 'failed' | 'retryable';

export interface SyncState<T = any> {
  entityId: string;
  entityType: string;
  status: SyncStatus;
  payload: T;
  retryCount: number;
  lastAttemptAt?: string;
  error?: string | null;
}

export class SyncStateMachine {
  private static states: Map<string, SyncState> = new Map();

  /**
   * Initializes or transitions an entity to 'pending'.
   */
  static markPending<T>(entityType: string, entityId: string, payload: T): SyncState<T> {
    const key = `${entityType}:${entityId}`;
    const existing = this.states.get(key);
    const newState: SyncState<T> = {
      entityId,
      entityType,
      status: 'pending',
      payload,
      retryCount: existing ? existing.retryCount : 0,
      lastAttemptAt: new Date().toISOString(),
      error: null,
    };
    this.states.set(key, newState);
    return newState;
  }

  /**
   * Transitions an entity to 'syncing' when the network call begins.
   */
  static markSyncing(entityType: string, entityId: string): SyncState | null {
    const key = `${entityType}:${entityId}`;
    const state = this.states.get(key);
    if (!state) return null;

    state.status = 'syncing';
    state.lastAttemptAt = new Date().toISOString();
    return state;
  }

  /**
   * Transitions an entity to 'synced' upon confirmed Supabase response.
   */
  static markSynced(entityType: string, entityId: string): SyncState | null {
    const key = `${entityType}:${entityId}`;
    const state = this.states.get(key);
    if (!state) return null;

    state.status = 'synced';
    state.error = null;
    return state;
  }

  /**
   * Transitions an entity to 'failed' and marks it 'retryable'.
   */
  static markFailed(entityType: string, entityId: string, error: Error | string): SyncState | null {
    const key = `${entityType}:${entityId}`;
    const state = this.states.get(key);
    if (!state) return null;

    state.status = 'failed';
    state.error = typeof error === 'string' ? error : error.message || 'Sync failed';
    state.retryCount += 1;
    return state;
  }

  /**
   * Gets current sync status for an entity.
   */
  static getStatus(entityType: string, entityId: string): SyncStatus {
    const key = `${entityType}:${entityId}`;
    return this.states.get(key)?.status || 'idle';
  }

  /**
   * Returns all failed/retryable items for automatic or manual retry.
   */
  static getRetryableItems(): SyncState[] {
    const retryable: SyncState[] = [];
    this.states.forEach((state) => {
      if (state.status === 'failed' || state.status === 'retryable') {
        retryable.push({ ...state });
      }
    });
    return retryable;
  }

  /**
   * Clears state machine storage (e.g. on logout).
   */
  static clear(): void {
    this.states.clear();
  }
}

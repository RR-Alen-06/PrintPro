/**
 * Resilient Offline Synchronization Engine for PrintPro.
 *
 * Implements:
 * 1. Sequential FIFO queue processing.
 * 2. Dynamic ID Reference Rewriting (resolves offline temporary IDs to server IDs before API calls).
 * 3. Exponential Backoff for transient network drops.
 * 4. Dead-Letter Quarantine (DLQ) for fatal 4xx/5xx errors so the queue never freezes.
 * 5. Local State & ID Mapping Reconciliation callbacks.
 */

import { syncEntityToCloud } from './syncService';
import {
  getOfflineQueue,
  dequeueOfflineAction,
  incrementQueueRetry,
  moveToDeadLetter,
  saveIdMapping,
  getIdMappings
} from './indexedDbStore';

let isSyncing = false;

/**
 * Helper to determine if an error is a transient network drop vs a fatal client/server error.
 */
function isTransientNetworkError(error) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  if (!error) return false;
  // Axios network error or timeout
  if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || error.message?.includes('Network Error')) {
    return true;
  }
  // No response object usually indicates network unreachable / DNS failure
  if (!error.response) {
    return true;
  }
  // Server temporarily unavailable (502, 503, 504)
  const status = error.response.status;
  if (status === 502 || status === 503 || status === 504) {
    return true;
  }
  return false;
}

/**
 * Recursively or deeply rewrites any temporary IDs present in an action payload
 * using the provided idMappings map.
 */
function rewritePayloadReferences(payload, idMappings) {
  if (!payload || typeof payload !== 'object' || idMappings.size === 0) {
    return payload;
  }

  const clone = JSON.parse(JSON.stringify(payload));

  const resolveId = (val) => {
    if (!val || typeof val !== 'string') return val;
    if (idMappings.has(val)) {
      return idMappings.get(val).serverId;
    }
    return val;
  };

  if (clone.customerId) clone.customerId = resolveId(clone.customerId);
  if (clone.customer_id) clone.customer_id = resolveId(clone.customer_id);
  if (clone.billId) clone.billId = resolveId(clone.billId);
  if (clone.bill_id) clone.bill_id = resolveId(clone.bill_id);
  if (clone.targetBillPayId) clone.targetBillPayId = resolveId(clone.targetBillPayId);

  // Nested updates object
  if (clone.updates && typeof clone.updates === 'object') {
    if (clone.updates.customerId) clone.updates.customerId = resolveId(clone.updates.customerId);
    if (clone.updates.billId) clone.updates.billId = resolveId(clone.updates.billId);
  }

  return clone;
}

/**
 * Process the offline queue for a specific user.
 *
 * @param {string} userId - Auth user UUID
 * @param {object} options
 * @param {Function} [options.onSyncSuccess] - Callback when items sync (count, reconciledIds)
 * @param {Function} [options.onDeadLetter] - Callback when an item is moved to DLQ
 * @param {Function} [options.onQueueUpdated] - Callback with remaining queue length
 * @returns {Promise<{ syncedCount: number, quarantinedCount: number }>}
 */
export async function processUserOfflineQueue(userId, options = {}) {
  if (!userId) return { syncedCount: 0, quarantinedCount: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedCount: 0, quarantinedCount: 0 };
  }
  if (isSyncing) {
    return { syncedCount: 0, quarantinedCount: 0 };
  }

  isSyncing = true;
  let syncedCount = 0;
  let quarantinedCount = 0;
  const reconciledEntities = [];

  try {
    const queue = await getOfflineQueue(userId);
    if (!queue || queue.length === 0) {
      isSyncing = false;
      return { syncedCount: 0, quarantinedCount: 0 };
    }

    const idMappings = await getIdMappings(userId);

    for (const item of queue) {
      // Check if network went down during loop
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.warn('[SyncEngine] Network went offline mid-sync, pausing queue.');
        break;
      }

      // 1. Rewrite any temporary ID references in payload
      const rewrittenPayload = rewritePayloadReferences(item.payload, idMappings);

      try {
        const response = await syncEntityToCloud(item.actionType, rewrittenPayload);

        // 2. Extract server-assigned IDs and numbers if present
        const serverData = response?.data?.data || response?.data;
        if (serverData && (serverData.id || serverData.bill_number || serverData.customer_code)) {
          const originalTempId = item.payload?.id;
          const serverId = serverData.id;
          const serverCode = serverData.bill_number || serverData.customer_code || serverData.payment_number || '';

          if (originalTempId && originalTempId !== serverId) {
            await saveIdMapping(userId, originalTempId, serverId, serverCode);
            idMappings.set(originalTempId, { serverId, serverCode });

            reconciledEntities.push({
              actionType: item.actionType,
              tempId: originalTempId,
              serverId,
              serverCode,
              entity: serverData,
            });
          }
        }

        // 3. Successfully synced: dequeue from IndexedDB
        await dequeueOfflineAction(userId, item.id);
        syncedCount++;

        if (options.onQueueUpdated) {
          const remaining = await getOfflineQueue(userId);
          options.onQueueUpdated(remaining.length);
        }
      } catch (err) {
        if (isTransientNetworkError(err)) {
          // Transient network drop: increment retry and pause queue for reconnect
          console.warn(`[SyncEngine] Transient network failure on ${item.actionType}. Queue paused.`, err.message);
          await incrementQueueRetry(userId, item.id);
          break; // Preserve FIFO for network drops
        } else {
          // Fatal 4xx or bad payload: Quarantine to DLQ so queue is NOT blocked
          console.error(`[SyncEngine] Fatal error on ${item.actionType}. Moving to Dead-Letter Queue.`, err);
          await moveToDeadLetter(userId, item, err);
          quarantinedCount++;

          if (options.onDeadLetter) {
            options.onDeadLetter(item, err);
          }

          if (options.onQueueUpdated) {
            const remaining = await getOfflineQueue(userId);
            options.onQueueUpdated(remaining.length);
          }
        }
      }
    }

    if (syncedCount > 0 && options.onSyncSuccess) {
      options.onSyncSuccess(syncedCount, reconciledEntities);
    }
  } catch (err) {
    console.error('[SyncEngine] Unexpected error during queue processing:', err);
  } finally {
    isSyncing = false;
  }

  return { syncedCount, quarantinedCount };
}

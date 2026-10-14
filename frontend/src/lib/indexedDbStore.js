/**
 * Per-User IndexedDB Storage Engine for PrintPro.
 *
 * Provides:
 * 1. Zero-quota-crash async storage (indexedDB instead of 5MB localStorage).
 * 2. Strict multi-tenant user isolation: database is keyed by user ID (`printpro_db_${userId}`).
 * 3. Offline action queue and Dead-Letter Queue (DLQ) stores.
 * 4. Temporary-to-Server ID mapping store.
 * 5. Automatic migration from legacy un-scoped localStorage.
 */

const DB_VERSION = 1;
const dbCache = new Map();

/**
 * Get or open the IndexedDB instance for a specific authenticated user.
 * @param {string} userId - Supabase auth user UUID
 * @returns {Promise<IDBDatabase>}
 */
export function openUserDatabase(userId) {
  if (!userId) {
    return Promise.reject(new Error('Cannot open IndexedDB without a valid userId.'));
  }

  const dbName = `printpro_db_${userId}`;

  if (dbCache.has(dbName)) {
    const cachedDb = dbCache.get(dbName);
    // Return cached connection if not closed
    try {
      if (cachedDb && cachedDb.name === dbName) {
        return Promise.resolve(cachedDb);
      }
    } catch {
      dbCache.delete(dbName);
    }
  }

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const request = window.indexedDB.open(dbName, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. App State store (key-value)
      if (!db.objectStoreNames.contains('app_state')) {
        db.createObjectStore('app_state', { keyPath: 'key' });
      }

      // 2. Offline Action Queue (FIFO sequential)
      if (!db.objectStoreNames.contains('offline_queue')) {
        db.createObjectStore('offline_queue', { keyPath: 'id', autoIncrement: true });
      }

      // 3. Dead-Letter Queue (DLQ - fatal failures quarantined here)
      if (!db.objectStoreNames.contains('dead_letter_queue')) {
        db.createObjectStore('dead_letter_queue', { keyPath: 'id', autoIncrement: true });
      }

      // 4. Temporary-to-Server ID Mappings
      if (!db.objectStoreNames.contains('id_mappings')) {
        db.createObjectStore('id_mappings', { keyPath: 'tempId' });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      dbCache.set(dbName, db);

      db.onclose = () => {
        dbCache.delete(dbName);
      };

      resolve(db);
    };

    request.onerror = (event) => {
      reject(event.target.error || new Error(`Failed to open IndexedDB "${dbName}"`));
    };
  });
}

/**
 * Close any open connection for a specific user.
 * @param {string} userId
 */
export function closeUserDatabase(userId) {
  if (!userId) return;
  const dbName = `printpro_db_${userId}`;
  const db = dbCache.get(dbName);
  if (db) {
    try {
      db.close();
    } catch {
      // ignore close errors
    }
    dbCache.delete(dbName);
  }
}

/**
 * Execute an IndexedDB transaction asynchronously.
 */
function runTransaction(db, storeNames, mode, callback) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    let result = undefined;

    transaction.oncomplete = () => resolve(result);
    transaction.onabort = (e) => reject(e.target.error || new Error('Transaction aborted'));
    transaction.onerror = (e) => reject(e.target.error || new Error('Transaction error'));

    try {
      result = callback(transaction);
    } catch (err) {
      reject(err);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// APP STATE OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load the cached application state for a user.
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function loadUserState(userId) {
  if (!userId) return null;
  const db = await openUserDatabase(userId);
  return runTransaction(db, ['app_state'], 'readonly', (tx) => {
    return new Promise((resolve, reject) => {
      const store = tx.objectStore('app_state');
      const req = store.get('cached_state');
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Save the application state snapshot for a user.
 * @param {string} userId
 * @param {object} state
 */
export async function saveUserState(userId, state) {
  if (!userId || !state) return;
  const db = await openUserDatabase(userId);
  // Strip transient authentication/runtime pointers
  const { currentUser: _c, users: _u, ...persistentData } = state;

  return runTransaction(db, ['app_state'], 'readwrite', (tx) => {
    const store = tx.objectStore('app_state');
    store.put({
      key: 'cached_state',
      data: persistentData,
      savedAt: Date.now(),
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFLINE QUEUE OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all queued offline actions for a user, sorted by FIFO id.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getOfflineQueue(userId) {
  if (!userId) return [];
  const db = await openUserDatabase(userId);
  return runTransaction(db, ['offline_queue'], 'readonly', (tx) => {
    return new Promise((resolve, reject) => {
      const store = tx.objectStore('offline_queue');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Enqueue a new offline action for a user.
 * @param {string} userId
 * @param {object} action - { actionType, payload }
 * @returns {Promise<number>} the auto-increment queue item ID
 */
export async function enqueueOfflineAction(userId, action) {
  if (!userId || !action) return null;
  const db = await openUserDatabase(userId);
  return runTransaction(db, ['offline_queue'], 'readwrite', (tx) => {
    return new Promise((resolve, reject) => {
      const store = tx.objectStore('offline_queue');
      const req = store.add({
        actionType: action.actionType,
        payload: action.payload,
        timestamp: Date.now(),
        retryCount: 0,
      });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Dequeue a successfully synced action by ID.
 * @param {string} userId
 * @param {number} queueId
 */
export async function dequeueOfflineAction(userId, queueId) {
  if (!userId || queueId === undefined) return;
  const db = await openUserDatabase(userId);
  return runTransaction(db, ['offline_queue'], 'readwrite', (tx) => {
    const store = tx.objectStore('offline_queue');
    store.delete(queueId);
  });
}

/**
 * Increment retry count on an action that encountered a transient network drop.
 * @param {string} userId
 * @param {number} queueId
 */
export async function incrementQueueRetry(userId, queueId) {
  if (!userId || queueId === undefined) return;
  const db = await openUserDatabase(userId);
  return runTransaction(db, ['offline_queue'], 'readwrite', (tx) => {
    const store = tx.objectStore('offline_queue');
    const req = store.get(queueId);
    req.onsuccess = () => {
      if (req.result) {
        req.result.retryCount = (req.result.retryCount || 0) + 1;
        req.result.lastAttempt = Date.now();
        store.put(req.result);
      }
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DEAD-LETTER QUEUE (DLQ) OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Move a permanently failed action from offline_queue to dead_letter_queue.
 * @param {string} userId
 * @param {object} queueItem
 * @param {object|string} errorDetails
 */
export async function moveToDeadLetter(userId, queueItem, errorDetails) {
  if (!userId || !queueItem) return;
  const db = await openUserDatabase(userId);

  return runTransaction(db, ['offline_queue', 'dead_letter_queue'], 'readwrite', (tx) => {
    const queueStore = tx.objectStore('offline_queue');
    const dlqStore = tx.objectStore('dead_letter_queue');

    // Remove from active queue
    if (queueItem.id !== undefined) {
      queueStore.delete(queueItem.id);
    }

    // Add to DLQ
    dlqStore.add({
      actionType: queueItem.actionType,
      payload: queueItem.payload,
      originalTimestamp: queueItem.timestamp,
      quarantinedAt: Date.now(),
      error: typeof errorDetails === 'object' ? {
        message: errorDetails.message,
        status: errorDetails.status || errorDetails.response?.status,
        data: errorDetails.response?.data || errorDetails.data
      } : String(errorDetails),
    });
  });
}

/**
 * Get all quarantined dead-letter items for a user.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getDeadLetterQueue(userId) {
  if (!userId) return [];
  const db = await openUserDatabase(userId);
  return runTransaction(db, ['dead_letter_queue'], 'readonly', (tx) => {
    return new Promise((resolve, reject) => {
      const store = tx.objectStore('dead_letter_queue');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Dismiss or remove an item from the dead-letter queue.
 * @param {string} userId
 * @param {number} dlqId
 */
export async function removeDeadLetterItem(userId, dlqId) {
  if (!userId || dlqId === undefined) return;
  const db = await openUserDatabase(userId);
  return runTransaction(db, ['dead_letter_queue'], 'readwrite', (tx) => {
    const store = tx.objectStore('dead_letter_queue');
    store.delete(dlqId);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ID MAPPINGS (TEMPORARY CLIENT ID -> SERVER ASSIGNED ID)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save an ID mapping (e.g. temp-bill-101 -> { id: 'uuid-123', billNumber: 'BILL-0005' })
 * @param {string} userId
 * @param {string} tempId
 * @param {string|number} serverId
 * @param {string} [serverCode]
 */
export async function saveIdMapping(userId, tempId, serverId, serverCode = '') {
  if (!userId || !tempId || !serverId) return;
  const db = await openUserDatabase(userId);
  return runTransaction(db, ['id_mappings'], 'readwrite', (tx) => {
    const store = tx.objectStore('id_mappings');
    store.put({
      tempId: String(tempId),
      serverId: String(serverId),
      serverCode: serverCode || '',
      createdAt: Date.now(),
    });
  });
}

/**
 * Retrieve all ID mappings as an in-memory dictionary.
 * @param {string} userId
 * @returns {Promise<Map<string, { serverId: string, serverCode: string }>>}
 */
export async function getIdMappings(userId) {
  if (!userId) return new Map();
  const db = await openUserDatabase(userId);
  return runTransaction(db, ['id_mappings'], 'readonly', (tx) => {
    return new Promise((resolve, reject) => {
      const store = tx.objectStore('id_mappings');
      const req = store.getAll();
      req.onsuccess = () => {
        const map = new Map();
        (req.result || []).forEach((item) => {
          map.set(item.tempId, { serverId: item.serverId, serverCode: item.serverCode });
        });
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION & CLEANUP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Automatically migrate legacy un-scoped localStorage data into this user's IndexedDB,
 * then purge legacy localStorage keys to eliminate storage quota limits and shared-device data leakage.
 * @param {string} userId
 */
export async function migrateLegacyLocalStorage(userId) {
  if (!userId || typeof window === 'undefined') return;

  try {
    const legacyState = window.localStorage.getItem('printpro-state');
    if (legacyState) {
      const parsed = JSON.parse(legacyState);
      const existing = await loadUserState(userId);
      // Only import if IndexedDB is currently empty
      if (!existing && parsed) {
        await saveUserState(userId, parsed);
        console.log(`[IndexedDB] Migrated legacy printpro-state into printpro_db_${userId}`);
      }
      window.localStorage.removeItem('printpro-state');
    }

    const legacyQueue = window.localStorage.getItem('printpro-offline-queue');
    if (legacyQueue) {
      const parsedQueue = JSON.parse(legacyQueue);
      if (Array.isArray(parsedQueue) && parsedQueue.length > 0) {
        for (const item of parsedQueue) {
          await enqueueOfflineAction(userId, item);
        }
        console.log(`[IndexedDB] Migrated ${parsedQueue.length} legacy offline actions into printpro_db_${userId}`);
      }
      window.localStorage.removeItem('printpro-offline-queue');
    }
  } catch (err) {
    console.warn('[IndexedDB] Legacy migration check non-fatal error:', err);
  }
}

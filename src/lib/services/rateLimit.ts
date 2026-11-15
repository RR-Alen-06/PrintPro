import type { SupabaseClient } from '@supabase/supabase-js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

function pruneMemoryStore(now: number): void {
  if (memoryStore.size > 500) {
    for (const [k, v] of memoryStore.entries()) {
      if (now >= v.resetAt) memoryStore.delete(k);
    }
  }
}

function checkMemoryRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number,
  increment: boolean
): { blocked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  pruneMemoryStore(now);
  const entry = memoryStore.get(key);

  if (!entry || now >= entry.resetAt) {
    if (increment) {
      memoryStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    } else {
      memoryStore.delete(key);
    }
    return { blocked: false, retryAfterSeconds: 0 };
  }

  if (entry.count >= maxAttempts) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  if (increment) {
    entry.count += 1;
  }
  return { blocked: false, retryAfterSeconds: 0 };
}

/**
 * Checks (and optionally increments) a rate limit using Supabase RPC when available,
 * falling back to an in-memory store for unconfigured local/test environments.
 */
export async function checkRateLimit(
  supabase: SupabaseClient | null,
  key: string,
  maxAttempts: number,
  windowSeconds: number,
  increment = true
): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  if (supabase && typeof supabase.rpc === 'function') {
    try {
      const { data, error } = await supabase.rpc('check_and_increment_rate_limit', {
        p_key: key,
        p_max_attempts: maxAttempts,
        p_window_seconds: windowSeconds,
        p_increment: increment,
      });
      if (!error && data && typeof data.blocked === 'boolean') {
        return {
          blocked: data.blocked,
          retryAfterSeconds: Number(data.retry_after_seconds) || 0,
        };
      }
    } catch {
      // Fall back to in-memory limiter if RPC is unavailable
    }
  }
  return checkMemoryRateLimit(key, maxAttempts, windowSeconds, increment);
}

export async function clearRateLimit(supabase: SupabaseClient | null, key: string): Promise<void> {
  memoryStore.delete(key);
  if (supabase && typeof supabase.rpc === 'function') {
    try {
      await supabase.rpc('clear_rate_limit', { p_key: key });
    } catch {
      // Ignore fallback cleanup errors
    }
  }
}

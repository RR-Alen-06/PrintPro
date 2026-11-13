import { supabase, isSupabaseConfigured } from '../supabase/client';
import { AllSettings } from '../types';
import { DEFAULT_SETTINGS, getUserId, logAudit } from './shared';

export class SettingsService {
  private static cachedSettings: { data: AllSettings; timestamp: number } | null = null;
  private static readonly SETTINGS_CACHE_TTL_MS = 30000;

  static invalidateCache(): void {
    this.cachedSettings = null;
  }

  static async getSettings(forceRefresh = false): Promise<AllSettings> {
    const now = Date.now();
    if (!forceRefresh && this.cachedSettings && (now - this.cachedSettings.timestamp < this.SETTINGS_CACHE_TTL_MS)) {
      return this.cachedSettings.data;
    }
    if (!isSupabaseConfigured) {
      return DEFAULT_SETTINGS;
    }

    const query = supabase.from('settings').select('*');
    const { data, error } = await query;
    if (error || !data) return DEFAULT_SETTINGS;

    const merged = { ...DEFAULT_SETTINGS };
    data.forEach((row: { key: string; value: unknown }) => {
      const k = row.key as keyof AllSettings;
      if (k in merged) {
        (merged as unknown as Record<string, unknown>)[k] = {
          ...((merged as unknown as Record<string, unknown>)[k] as Record<string, unknown>),
          ...(row.value as Record<string, unknown>)
        };
      }
    });
    // Never expose raw super_admin_pin to client state; verification happens via /api/verify-pin or RPC
    merged.security = {
      ...merged.security,
      super_admin_pin: '****'
    };
    this.cachedSettings = { data: merged, timestamp: Date.now() };
    return merged;
  }

  static async getRawSecurityPin(): Promise<string> {
    if (!isSupabaseConfigured) return DEFAULT_SETTINGS.security.super_admin_pin;
    try {
      const { data } = await supabase.from('settings').select('value').eq('key', 'security').limit(1);
      const val = data?.[0]?.value as { super_admin_pin?: string } | undefined;
      return (val?.super_admin_pin || DEFAULT_SETTINGS.security.super_admin_pin).trim();
    } catch {
      return DEFAULT_SETTINGS.security.super_admin_pin;
    }
  }

  static async verifyAdminPin(pin: string): Promise<boolean> {
    const cleanPin = String(pin || '').trim();
    if (!cleanPin) return false;

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        const res = await fetch('/api/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: cleanPin })
        });
        const data = await res.json().catch(() => ({}));
        return res.ok && data?.valid === true;
      } catch {
        // Fallback for non-browser / test environments where relative fetch is unavailable
      }
    }

    if (isSupabaseConfigured) {
      try {
        const { data: rpcValid, error: rpcErr } = await supabase.rpc('verify_admin_pin', { p_pin: cleanPin });
        if (!rpcErr && typeof rpcValid === 'boolean') {
          return rpcValid;
        }
      } catch {
        // Fallback when RPC is not yet deployed
      }
    }

    const expected = await this.getRawSecurityPin();
    return cleanPin === expected;
  }

  static async saveSettings(key: keyof AllSettings, value: unknown, userName = 'Super Admin'): Promise<void> {
    this.cachedSettings = null;
    if (!isSupabaseConfigured) return;
    const userId = await getUserId();

    const allowedKeys: Array<keyof AllSettings> = ['shop', 'billing', 'loyalty', 'whatsapp', 'security', 'app', 'expenses'];
    if (!allowedKeys.includes(key)) {
      throw new Error(`Unauthorized settings category: ${String(key)}`);
    }

    let sanitizedValue = value;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const copy = { ...(value as Record<string, unknown>) };
      delete copy.role;
      delete copy.permissions;
      delete copy.id;
      delete copy.user_id;
      delete copy.status;
      delete copy.credits;
      delete copy.price;
      if (key === 'security') {
        const pinVal = typeof copy.super_admin_pin === 'string' ? copy.super_admin_pin.trim() : '';
        if (!pinVal || pinVal === '****') {
          copy.super_admin_pin = await this.getRawSecurityPin();
        }
      }
      sanitizedValue = copy;
    }

    const prev = await this.getSettings();
    const nowIso = new Date().toISOString();

    let existingQuery = supabase.from('settings').select('id').eq('key', key);
    if (userId) {
      existingQuery = existingQuery.eq('user_id', userId);
    } else {
      existingQuery = existingQuery.is('user_id', null);
    }
    const { data: existingRows, error: selectErr } = await existingQuery.limit(1);
    if (selectErr) throw new Error(selectErr.message);

    if (existingRows && existingRows.length > 0) {
      let updateQuery = supabase
        .from('settings')
        .update({ value: sanitizedValue, updated_at: nowIso })
        .eq('key', key);
      if (userId) {
        updateQuery = updateQuery.eq('user_id', userId);
      } else {
        updateQuery = updateQuery.is('user_id', null);
      }
      const { error: updateErr } = await updateQuery;
      if (updateErr) throw new Error(updateErr.message);
    } else {
      const { error: insertErr } = await supabase.from('settings').insert([{
        key,
        value: sanitizedValue,
        ...(userId ? { user_id: userId } : {}),
        updated_at: nowIso
      }]);
      if (insertErr) throw new Error(insertErr.message);
    }

    await logAudit({
      user_name: userName,
      action: 'UPDATE_SETTINGS',
      entity: `settings.${key}`,
      previous_value: JSON.stringify(prev[key]),
      new_value: key === 'security' ? '[REDACTED]' : JSON.stringify(sanitizedValue)
    });
  }
}

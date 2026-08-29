import { supabase } from '../lib/supabase';
import { SequenceConfig } from '../types/billing';

export type SequenceKey = 'BILL' | 'PAY' | 'CUS' | 'EXP' | 'GRP' | 'RET' | string;

export class SequenceService {
  private static readonly DEFAULT_PREFIXES: Record<string, string> = {
    BILL: 'BILL',
    PAY: 'PAY',
    CUS: 'CUS',
    EXP: 'EXP',
    GRP: 'GRP',
    RET: 'RET',
  };

  /**
   * Generates the next sequential ID atomically for a given entity key.
   * Calls get_next_sequence RPC in Supabase with user isolation, with fallback to table query.
   */
  static async getNextSequence(key: SequenceKey): Promise<string> {
    const uppercaseKey = key.toUpperCase();
    try {
      const { data, error } = await supabase.rpc('get_next_sequence', { p_key: uppercaseKey });
      if (!error && data) {
        return data;
      }
      return await this.fallbackSequence(uppercaseKey);
    } catch {
      return await this.fallbackSequence(uppercaseKey);
    }
  }

  /**
   * Formats a sequential number code given prefix, numeric value, and padding width.
   */
  static formatSequenceCode(prefix: string, value: number, padding: number = 6): string {
    const cleanPrefix = (prefix || 'SEQ').toUpperCase();
    const cleanPadding = Math.min(12, Math.max(2, padding || 6));
    const cleanValue = Math.max(1, Math.floor(Number(value) || 1));
    return `${cleanPrefix}-${String(cleanValue).padStart(cleanPadding, '0')}`;
  }

  private static async fallbackSequence(key: string): Promise<string> {
    try {
      const { data: seq } = await supabase
        .from('sequences')
        .select('*')
        .eq('key', key)
        .maybeSingle();

      const defaultPrefix = this.DEFAULT_PREFIXES[key] || key.slice(0, 3).toUpperCase();
      const prefix = seq?.prefix || defaultPrefix;
      const padding = seq?.padding || 6;
      const nextVal = (seq?.current_val || 0) + 1;

      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('sequences').upsert({
        user_id: user?.id || null,
        key,
        prefix,
        padding,
        current_val: nextVal,
        updated_at: new Date().toISOString(),
      });

      return this.formatSequenceCode(prefix, nextVal, padding);
    } catch {
      // Local graceful fallback if offline/disconnected
      const prefix = this.DEFAULT_PREFIXES[key] || key.slice(0, 3).toUpperCase();
      const fallbackNum = Date.now().toString().slice(-6);
      return `${prefix}-${fallbackNum}`;
    }
  }

  static async getSequences(): Promise<SequenceConfig[]> {
    const { data, error } = await supabase
      .from('sequences')
      .select('*')
      .order('key', { ascending: true });

    if (error) return [];
    return data || [];
  }

  static async updateSequenceConfig(key: SequenceKey, prefix: string, padding: number): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const uppercaseKey = key.toUpperCase();
    const { error } = await supabase.from('sequences').upsert({
      user_id: user?.id || null,
      key: uppercaseKey,
      prefix: prefix.toUpperCase(),
      padding: Math.min(12, Math.max(2, padding)),
      updated_at: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);
  }
}

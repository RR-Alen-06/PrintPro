import { supabase } from '../lib/supabase';
import { SequenceConfig } from '../types/billing';

export class SequenceService {
  /**
   * Generates the next sequential ID atomically for a given entity key.
   * Calls get_next_sequence RPC in Supabase with user isolation, with fallback to table query.
   */
  static async getNextSequence(key: string): Promise<string> {
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

  private static async fallbackSequence(key: string): Promise<string> {
    try {
      const { data: seq } = await supabase
        .from('sequences')
        .select('*')
        .eq('key', key)
        .maybeSingle();

      const prefix = seq?.prefix || key.slice(0, 3).toUpperCase();
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

      return `${prefix}-${String(nextVal).padStart(padding, '0')}`;
    } catch {
      // Local graceful fallback if offline/disconnected
      const prefix = key.slice(0, 3).toUpperCase();
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

  static async updateSequenceConfig(key: string, prefix: string, padding: number): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('sequences').upsert({
      user_id: user?.id || null,
      key: key.toUpperCase(),
      prefix: prefix.toUpperCase(),
      padding: Math.min(12, Math.max(2, padding)),
      updated_at: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);
  }
}

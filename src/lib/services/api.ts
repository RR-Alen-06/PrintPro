import { supabase, isSupabaseConfigured } from '../supabase/client';
import {
  Customer,
  Product,
  Bill,
  BillItem,
  Payment,
  Expense,
  CustomerLedgerEntry,
  CustomerSummary,
  DashboardStats,
  AllSettings,
  RoundingMethod,
  AuditLog,
  DateFilterOption,
  SequenceConfig,
  PaymentSummary,
  LoyaltyRule,
  LoyaltyRedemptionRule,
  LoyaltySettings,
  BillFinancialSummary,
  PaymentMethod,
  ProductSalesAnalytics,
  ProductSalesHistoryItem,
  CustomerStatementData,
  CustomerStatementTransaction,
  CustomerStatementBill,
  CustomerStatementBillItem,
  CustomerStatementDateGroup,
  CustomItemAnalytics,
  ShopSettings,
  InternalTransfer,
  AccountingClosing,
  CurrentSessionStatus,
  ReconciliationCalculation,
  UnpaidSessionBill,
  EditBillInput,
  GroupBill,
  CreateSplitBillingInput,
  CreateSharedBillingInput
} from '../types';

export const DEFAULT_SETTINGS: AllSettings = {
  shop: {
    shop_name: 'PrintPro Store',
    address: '',
    phone: '',
    email: '',
    gst_number: '',
    logo_url: '',
    footer_message: 'Thank you for your business!'
  },
  billing: {
    bill_prefix: 'BILL',
    bill_format: 'BILL-{SEQ}',
    default_payment_method: 'Cash',
    currency_symbol: '₹',
    decimal_precision: 2,
    gst_enabled: false,
    gst_rate: 0,
    default_printer_size: '80mm',
    auto_print: false,
    rounding_method: 'None'
  },
  loyalty: {
    enabled: true,
    calculation_mode: 'rate',
    earn_points: 1,
    earn_spend_unit: 10,
    points_required: 10,
    discount_value: 5
  },
  whatsapp: {
    enabled: true,
    template_text: '',
    enable_pdf_sharing: true,
    enable_text_sharing: true,
    email_service_id: '',
    email_template_id: '',
    email_public_key: ''
  },
  security: {
    super_admin_pin: '1234',
    session_timeout_minutes: 30,
    payment_reversal_window_hours: 72
  },
  app: {
    theme: 'light',
    date_format: 'DD/MM/YYYY',
    time_format: '12h'
  },
  expenses: {
    categories: [
      'Shop Expense',
      'Electricity',
      'Rent',
      'Paper Stock & Rolls',
      'Toner & Cartridges',
      'Machine Maintenance',
      'Staff Wages',
      'Other Expense'
    ],
    default_payment_mode: 'Cash'
  }
};

export class ApiService {
  /**
   * Helper to retrieve currently authenticated tenant user ID
   */
  static async getUserId(): Promise<string | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Helper to insert bill_items cleanly into public.bill_items
   */
  static async insertBillItems(items: Array<Record<string, unknown>>): Promise<void> {
    if (!items || items.length === 0) return;
    const { error } = await supabase.from('bill_items').insert(items as never);
    if (error) {
      throw new Error(`Failed to insert bill items: ${error.message}`);
    }
  }

  static async insertBillItemsWithFallback(items: Array<Record<string, unknown>>): Promise<void> {
    return this.insertBillItems(items);
  }


  private static readonly DEFAULT_SEQUENCES: Array<{ key: string; prefix: string; padding: number }> = [
    { key: 'AUDIT', prefix: 'AUD', padding: 6 },
    { key: 'BILL', prefix: 'INV', padding: 6 },
    { key: 'CLOSE', prefix: 'CLS', padding: 6 },
    { key: 'CUSTOMER', prefix: 'CUST', padding: 6 },
    { key: 'EXPENSE', prefix: 'EXP', padding: 6 },
    { key: 'GROUP_BILL', prefix: 'GRP', padding: 6 },
    { key: 'LOYALTY', prefix: 'LTX', padding: 6 },
    { key: 'PAYMENT', prefix: 'PAY', padding: 6 },
    { key: 'PRODUCT', prefix: 'PROD', padding: 6 },
    { key: 'TRANS', prefix: 'TRF', padding: 6 }
  ];

  static async getNextSequence(key: string): Promise<string> {
    if (!isSupabaseConfigured) {
      const fallbackNum = Date.now().toString().slice(-6);
      return `${key.slice(0, 3).toUpperCase()}-${fallbackNum}`;
    }

    try {
      const { data, error } = await supabase.rpc('get_next_sequence', { p_key: key.toUpperCase() });
      if (error || !data) return await this.fallbackSequence(key);
      return data;
    } catch {
      return await this.fallbackSequence(key);
    }
  }


  private static async fallbackSequence(key: string): Promise<string> {
    const normalizedKey = key.trim().toUpperCase();
    const userId = await this.getUserId();
    const defaultCfg = this.DEFAULT_SEQUENCES.find(d => d.key === normalizedKey);

    const { data: rows } = await supabase
      .from('sequences')
      .select('*')
      .ilike('key', normalizedKey);

    const seq = (rows || []).sort((a, b) => Number(b.current_val || 0) - Number(a.current_val || 0))[0];

    const prefix = seq?.prefix || defaultCfg?.prefix || normalizedKey.slice(0, 3);
    const padding = Number(seq?.padding || defaultCfg?.padding || 6);
    const currentCounter = Number(seq?.current_val || 0);
    const nextVal = currentCounter + 1;

    if (seq?.id) {
      await supabase
        .from('sequences')
        .update({
          key: normalizedKey,
          prefix,
          padding,
          current_val: nextVal,
          updated_at: new Date().toISOString()
        })
        .eq('id', seq.id);
    } else {
      await supabase.from('sequences').insert({
        key: normalizedKey,
        prefix,
        padding,
        current_val: nextVal,
        ...(userId ? { user_id: userId } : {}),
        updated_at: new Date().toISOString()
      });
    }

    return `${prefix}-${String(nextVal).padStart(padding, '0')}`;
  }


  static async getSequences(): Promise<SequenceConfig[]> {
    if (!isSupabaseConfigured) return [];
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from('sequences')
      .select('*')
      .order('key', { ascending: true });

    if (error) {
      console.error('Error fetching sequences:', error);
    }

    const byKey = new Map<string, SequenceConfig>();
    const rawList = (data || []) as Array<Record<string, unknown>>;

    for (const row of rawList) {
      const rawKey = String(row.key || '').trim().toUpperCase();
      if (!rawKey) continue;
      // Map legacy key aliases if any remain
      const mappedKey =
        rawKey === 'CLOSING' ? 'CLOSE' :
        rawKey === 'TRANSFER' ? 'TRANS' :
        rawKey === 'LOYALTY_TX' ? 'LOYALTY' :
        rawKey;

      const counterVal = Number(row.current_val || 0);
      const existing = byKey.get(mappedKey);
      if (!existing || counterVal > existing.current_val) {
        byKey.set(mappedKey, {
          id: row.id as string | undefined,
          user_id: (row.user_id as string | null | undefined) ?? userId,
          key: mappedKey,
          prefix: String(row.prefix || mappedKey.slice(0, 3)).toUpperCase(),
          padding: Number(row.padding || 6),
          current_val: counterVal,
          updated_at: row.updated_at as string | undefined
        });
      }
    }

    // Ensure all 10 standard sequence keys exist in the list (and seed missing ones in background)
    const missingToSeed: Array<Record<string, unknown>> = [];
    for (const def of this.DEFAULT_SEQUENCES) {
      if (!byKey.has(def.key)) {
        const fallbackEntry: SequenceConfig = {
          user_id: userId,
          key: def.key,
          prefix: def.prefix,
          padding: def.padding,
          current_val: 0
        };
        byKey.set(def.key, fallbackEntry);
        missingToSeed.push({
          key: def.key,
          prefix: def.prefix,
          padding: def.padding,
          current_val: 0,
          ...(userId ? { user_id: userId } : {}),
          updated_at: new Date().toISOString()
        });
      }
    }

    if (missingToSeed.length > 0) {
      void supabase.from('sequences').insert(missingToSeed as never);
    }

    return Array.from(byKey.values()).sort((a, b) => a.key.localeCompare(b.key));
  }


  static async updateSequenceConfig(key: string, prefix: string, padding: number, userName = 'Super Admin'): Promise<void> {
    if (!isSupabaseConfigured) return;
    const normalizedKey = key.trim().toUpperCase();
    const cleanPrefix = prefix.trim().toUpperCase() || normalizedKey.slice(0, 3);
    const cleanPadding = Math.min(12, Math.max(2, Number(padding) || 6));
    const userId = await this.getUserId();

    const { data: existingRows, error: fetchErr } = await supabase
      .from('sequences')
      .select('*')
      .ilike('key', normalizedKey);

    if (fetchErr) throw new Error(fetchErr.message);

    if (existingRows && existingRows.length > 0) {
      // Keep the highest counter across any duplicate rows and update by ID
      const maxVal = existingRows.reduce((max, r) => {
        return Math.max(max, Number(r.current_val || 0));
      }, 0);

      const primaryId = existingRows[0].id;
      const { error: updateErr } = await supabase
        .from('sequences')
        .update({
          key: normalizedKey,
          prefix: cleanPrefix,
          padding: cleanPadding,
          current_val: maxVal,
          updated_at: new Date().toISOString()
        })
        .eq('id', primaryId);

      if (updateErr) throw new Error(updateErr.message);

      // Clean up any extra duplicate rows for the same key
      if (existingRows.length > 1) {
        const extraIds = existingRows.slice(1).map(r => r.id).filter(Boolean);
        if (extraIds.length > 0) {
          await supabase.from('sequences').delete().in('id', extraIds);
        }
      }
    } else {
      const { error: insertErr } = await supabase
        .from('sequences')
        .insert({
          key: normalizedKey,
          prefix: cleanPrefix,
          padding: cleanPadding,
          current_val: 0,
          ...(userId ? { user_id: userId } : {}),
          updated_at: new Date().toISOString()
        });

      if (insertErr) throw new Error(insertErr.message);
    }

    await this.logAudit({
      user_name: userName,
      action: 'UPDATE_SEQUENCE_CONFIG',
      entity: `Sequence ${normalizedKey}`,
      new_value: `Prefix: ${cleanPrefix}, Padding: ${cleanPadding}`
    });
  }


  static async getLoyaltyRedemptionRules(): Promise<LoyaltyRedemptionRule[]> {
    if (!isSupabaseConfigured) {
      return [];
    }

    const query = supabase
      .from('loyalty_redemption_rules')
      .select('*');

    const { data, error } = await query.order('points_required', { ascending: true });

    if (error) {
      console.error('Error fetching loyalty redemption rules:', error);
      return [];
    }

    if (!data || data.length === 0) return [];

    // Auto-deduplicate by points_required (keep one, collect duplicates to delete)
    const seen = new Set<number>();
    const uniqueRules: LoyaltyRedemptionRule[] = [];
    const duplicateIdsToDelete: string[] = [];

    for (const rule of data) {
      if (!seen.has(rule.points_required)) {
        seen.add(rule.points_required);
        uniqueRules.push(rule);
      } else {
        duplicateIdsToDelete.push(rule.id);
      }
    }

    // Auto-purge duplicates from database
    if (duplicateIdsToDelete.length > 0) {
      const delQuery = supabase.from('loyalty_redemption_rules').delete().in('id', duplicateIdsToDelete);
      delQuery.then();
    }

    return uniqueRules;
  }


  static async clearAllLoyaltyRedemptionRules(userName = 'Super Admin'): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const query = supabase.from('loyalty_redemption_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error } = await query;
    if (error) throw new Error(error.message);

    await this.logAudit({
      user_name: userName,
      action: 'CLEAR_ALL_LOYALTY_REDEMPTION_RULES',
      entity: 'All Redemption Rules'
    });
  }


  static async addLoyaltyRedemptionRule(rule: Omit<LoyaltyRedemptionRule, 'id' | 'created_at'>, userName = 'Super Admin'): Promise<LoyaltyRedemptionRule> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const userId = await this.getUserId();

    const pointsRequired = Number(rule.points_required);
    const discountAmount = Number(rule.discount_amount);
    const enabled = typeof rule.enabled === 'boolean' ? rule.enabled : true;

    // Prevent duplicate points_required rules
    const checkQuery = supabase
      .from('loyalty_redemption_rules')
      .select('id, points_required')
      .eq('points_required', pointsRequired);

    const { data: existing } = await checkQuery.maybeSingle();

    if (existing) {
      throw new Error(`A redemption rule for ${pointsRequired} Points already exists. Please edit the existing rule.`);
    }

    // Explicit allowlist: only permit points_required, discount_amount, enabled; drop everything else
    const payload = {
      points_required: pointsRequired,
      discount_amount: discountAmount,
      enabled,
      ...(userId ? { user_id: userId } : {})
    };

    const { data, error } = await supabase.from('loyalty_redemption_rules').insert([payload]).select().maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Failed to create loyalty redemption rule');

    await this.logAudit({
      user_name: userName,
      action: 'ADD_LOYALTY_REDEMPTION_RULE',
      entity: `Redemption Rule (${pointsRequired} pts = ₹${discountAmount})`,
      new_value: JSON.stringify(data)
    });

    return data;
  }


  static async updateLoyaltyRedemptionRule(id: string, rule: Partial<Omit<LoyaltyRedemptionRule, 'id' | 'created_at'>>, userName = 'Super Admin'): Promise<LoyaltyRedemptionRule | null> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    // Explicit allowlist: only permit points_required, discount_amount, enabled; drop all else (role, permissions, id, user_id, status)
    const allowedUpdates: Record<string, unknown> = {};
    if (rule.points_required !== undefined) allowedUpdates.points_required = Number(rule.points_required);
    if (rule.discount_amount !== undefined) allowedUpdates.discount_amount = Number(rule.discount_amount);
    if (rule.enabled !== undefined) allowedUpdates.enabled = Boolean(rule.enabled);

    if (Object.keys(allowedUpdates).length === 0) {
      return this.getLoyaltyRedemptionRules().then(rules => rules.find(r => r.id === id) || null);
    }

    const { data, error } = await supabase
      .from('loyalty_redemption_rules')
      .update(allowedUpdates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      return null;
    }

    await this.logAudit({
      user_name: userName,
      action: 'UPDATE_LOYALTY_REDEMPTION_RULE',
      entity: `Redemption Rule ID ${id}`,
      new_value: JSON.stringify(data)
    });

    return data;
  }


  static async deleteLoyaltyRedemptionRule(id: string, userName = 'Super Admin'): Promise<boolean> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    // Verify existence
    const { data: existing } = await supabase
      .from('loyalty_redemption_rules')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return false;
    }

    const { error } = await supabase
      .from('loyalty_redemption_rules')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    await this.logAudit({
      user_name: userName,
      action: 'DELETE_LOYALTY_REDEMPTION_RULE',
      entity: `Redemption Rule ID ${id}`
    });

    return true;
  }

  static calculateLoyaltyDiscount(pointsToRedeem: number, loyaltySettings: LoyaltySettings, activeRedemptionRules: LoyaltyRedemptionRule[] = []): number {
    if (pointsToRedeem <= 0 || !loyaltySettings?.enabled) return 0;

    const enabledRules = activeRedemptionRules.filter(r => r.enabled).sort((a, b) => b.points_required - a.points_required);

    if (enabledRules.length > 0) {
      let remainingPts = pointsToRedeem;
      let totalDiscount = 0;

      for (const rule of enabledRules) {
        if (remainingPts >= rule.points_required) {
          const multiplier = Math.floor(remainingPts / rule.points_required);
          totalDiscount += multiplier * Number(rule.discount_amount);
          remainingPts -= multiplier * rule.points_required;
        }
      }

      if (totalDiscount > 0) return Number(totalDiscount.toFixed(2));

      const bestRule = enabledRules[0];
      const rate = Number(bestRule.discount_amount) / Number(bestRule.points_required);
      return Number((pointsToRedeem * rate).toFixed(2));
    }

    if (loyaltySettings.points_required > 0 && loyaltySettings.discount_value > 0) {
      const ratePerPoint = loyaltySettings.discount_value / loyaltySettings.points_required;
      return Number((pointsToRedeem * ratePerPoint).toFixed(2));
    }

    return 0;
  }

  // --- SIMPLIFIED DYNAMIC LOYALTY EARNING RULES ---


  static async getLoyaltyRules(): Promise<LoyaltyRule[]> {
    if (!isSupabaseConfigured) {
      return [];
    }

    const query = supabase.from('loyalty_rules').select('*');
    const { data, error } = await query.order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching loyalty rules:', error);
      return [];
    }

    if (!data || data.length === 0) return [];

    // Deduplicate by rule_name
    const seen = new Set<string>();
    const uniqueRules: LoyaltyRule[] = [];
    const duplicateIdsToDelete: string[] = [];

    for (const rule of data) {
      const normalizedName = rule.rule_name?.trim().toLowerCase() || '';
      if (!seen.has(normalizedName)) {
        seen.add(normalizedName);
        uniqueRules.push(rule);
      } else {
        duplicateIdsToDelete.push(rule.id);
      }
    }

    if (duplicateIdsToDelete.length > 0) {
      const delQuery = supabase.from('loyalty_rules').delete().in('id', duplicateIdsToDelete);
      delQuery.then();
    }

    return uniqueRules;
  }


  static async clearAllLoyaltyRules(userName = 'Super Admin'): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const query = supabase.from('loyalty_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error } = await query;
    if (error) throw new Error(error.message);

    await this.logAudit({
      user_name: userName,
      action: 'CLEAR_ALL_LOYALTY_RULES',
      entity: 'All Loyalty Rules'
    });
  }


  static async addLoyaltyRule(rule: Omit<LoyaltyRule, 'id' | 'created_at'>, userName = 'Super Admin'): Promise<LoyaltyRule> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const userId = await this.getUserId();

    const ruleName = String(rule.rule_name || '').trim();
    if (!ruleName) throw new Error('Rule name is required');

    const checkQuery = supabase
      .from('loyalty_rules')
      .select('id, rule_name')
      .ilike('rule_name', ruleName);

    const { data: existing } = await checkQuery.maybeSingle();

    if (existing) {
      throw new Error(`A loyalty rule with the name "${ruleName}" already exists.`);
    }

    // Explicit allowlist: only permit rule_name, min_bill_amount, max_bill_amount, points_earned, enabled, sort_order; drop all else
    const payload = {
      rule_name: ruleName,
      min_bill_amount: Number(rule.min_bill_amount || 0),
      max_bill_amount: rule.max_bill_amount !== undefined && rule.max_bill_amount !== null ? Number(rule.max_bill_amount) : null,
      points_earned: Number(rule.points_earned || 0),
      enabled: typeof rule.enabled === 'boolean' ? rule.enabled : true,
      sort_order: Number(rule.sort_order || 0),
      ...(userId ? { user_id: userId } : {})
    };

    const { data, error } = await supabase.from('loyalty_rules').insert([payload]).select().maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Failed to create loyalty rule');

    await this.logAudit({
      user_name: userName,
      action: 'ADD_LOYALTY_RULE',
      entity: `Loyalty Rule (${ruleName})`,
      new_value: JSON.stringify(data)
    });

    return data;
  }


  static async updateLoyaltyRule(id: string, rule: Partial<Omit<LoyaltyRule, 'id' | 'created_at'>>, userName = 'Super Admin'): Promise<LoyaltyRule | null> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    // Explicit allowlist: only permit rule_name, min_bill_amount, max_bill_amount, points_earned, enabled, sort_order; drop all else (role, permissions, id, user_id, status)
    const allowedUpdates: Record<string, unknown> = {};
    if (rule.rule_name !== undefined) allowedUpdates.rule_name = String(rule.rule_name).trim();
    if (rule.min_bill_amount !== undefined) allowedUpdates.min_bill_amount = Number(rule.min_bill_amount);
    if (rule.max_bill_amount !== undefined) allowedUpdates.max_bill_amount = rule.max_bill_amount !== null ? Number(rule.max_bill_amount) : null;
    if (rule.points_earned !== undefined) allowedUpdates.points_earned = Number(rule.points_earned);
    if (rule.enabled !== undefined) allowedUpdates.enabled = Boolean(rule.enabled);
    if (rule.sort_order !== undefined) allowedUpdates.sort_order = Number(rule.sort_order);

    if (Object.keys(allowedUpdates).length === 0) {
      return this.getLoyaltyRules().then(rules => rules.find(r => r.id === id) || null);
    }

    const { data, error } = await supabase
      .from('loyalty_rules')
      .update(allowedUpdates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      return null;
    }

    await this.logAudit({
      user_name: userName,
      action: 'UPDATE_LOYALTY_RULE',
      entity: `Loyalty Rule ID ${id}`,
      new_value: JSON.stringify(data)
    });

    return data;
  }


  static async deleteLoyaltyRule(id: string, userName = 'Super Admin'): Promise<boolean> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    // Verify existence
    const { data: existing } = await supabase
      .from('loyalty_rules')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return false;
    }

    const { error } = await supabase
      .from('loyalty_rules')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    await this.logAudit({
      user_name: userName,
      action: 'DELETE_LOYALTY_RULE',
      entity: `Rule ID ${id}`
    });

    return true;
  }

  static async calculateLoyaltyPointsEarned(billAmount: number): Promise<number> {
    if (billAmount <= 0) return 0;

    const settings = await this.getSettings();
    if (settings.loyalty && settings.loyalty.enabled === false) {
      return 0;
    }

    // 1. PRIMARY: Check and evaluate active database rules in loyalty_rules table
    const rules = await this.getLoyaltyRules();
    const activeRules = rules.filter(r => r.enabled);

    if (activeRules.length > 0) {
      // Sort rules by min_bill_amount descending to match the highest qualified tier first
      const sortedRules = [...activeRules].sort((a, b) => {
        const minA = Number(a.min_bill_amount || 0);
        const minB = Number(b.min_bill_amount || 0);
        if (minB !== minA) return minB - minA;
        return (a.sort_order || 0) - (b.sort_order || 0);
      });

      for (const rule of sortedRules) {
        const min = Number(rule.min_bill_amount || 0);
        const hasMax = rule.max_bill_amount !== null && rule.max_bill_amount !== undefined && Number(rule.max_bill_amount) > 0;
        const max = hasMax ? Number(rule.max_bill_amount) : Infinity;

        if (billAmount >= min && billAmount <= max) {
          return Number(rule.points_earned);
        }
      }
    }

    // 2. FALLBACK: Rate-based calculation if no database rules matched or table is empty
    const earnPoints = Number(settings.loyalty?.earn_points ?? 1);
    const spendUnit = Number(settings.loyalty?.earn_spend_unit ?? 10);
    if (spendUnit > 0) {
      const earned = Math.floor(billAmount / spendUnit) * earnPoints;
      return Math.max(0, earned);
    }

    return 0;
  }

  // --- ROUNDING HELPER ---

  static calculateRounding(subtotalAfterDiscount: number, method: RoundingMethod): {
    roundedTotal: number;
    roundingAdjustment: number;
  } {
    let rounded = subtotalAfterDiscount;
    switch (method) {
      case 'Round Down':
        rounded = Math.floor(subtotalAfterDiscount);
        break;
      case 'Round Up':
        rounded = Math.ceil(subtotalAfterDiscount);
        break;
      case 'Standard':
        rounded = Math.round(subtotalAfterDiscount);
        break;
      case 'None':
      default:
        rounded = Number(subtotalAfterDiscount.toFixed(2));
        break;
    }
    const adjustment = Number((rounded - subtotalAfterDiscount).toFixed(2));
    return {
      roundedTotal: rounded,
      roundingAdjustment: adjustment
    };
  }

  // --- SETTINGS SERVICE ---
  private static cachedSettings: { data: AllSettings; timestamp: number } | null = null;
  private static readonly SETTINGS_CACHE_TTL_MS = 30000; // 30s cache


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
    this.cachedSettings = { data: merged, timestamp: Date.now() };
    return merged;
  }


  static async saveSettings(key: keyof AllSettings, value: unknown, userName = 'Super Admin'): Promise<void> {
    this.cachedSettings = null; // Invalidate cache on write
    if (!isSupabaseConfigured) return;
    const userId = await this.getUserId();

    // Explicit allowlist of settings categories
    const allowedKeys: (keyof AllSettings)[] = ['shop', 'billing', 'loyalty', 'whatsapp', 'security', 'app', 'expenses'];
    if (!allowedKeys.includes(key)) {
      throw new Error(`Unauthorized settings category: ${String(key)}`);
    }

    // Sanitize settings payload: drop any injected role, permissions, id, user_id, status, credits, price
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
      sanitizedValue = copy;
    }

    const prev = await this.getSettings();
    const nowIso = new Date().toISOString();

    // Update-or-insert by (user_id, key) / key without relying on a specific
    // ON CONFLICT unique index existing in the database.
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

    await this.logAudit({
      user_name: userName,
      action: 'UPDATE_SETTINGS',
      entity: `settings.${key}`,
      previous_value: JSON.stringify(prev[key]),
      new_value: JSON.stringify(value)
    });
  }


  static async logAudit(log: Omit<AuditLog, 'id' | 'created_at'>): Promise<void> {
    if (!isSupabaseConfigured) return;
    try {
      const userId = await this.getUserId();
      const auditNumber = await this.getNextSequence('AUDIT');
      await supabase.from('audit_logs').insert([{
        ...log,
        ...(userId ? { user_id: userId } : {}),
        audit_number: auditNumber
      }]);
    } catch (err) {
      console.error('Audit logging error:', err);
    }
  }


  static async getAuditLogs(): Promise<AuditLog[]> {
    if (!isSupabaseConfigured) return [];
    const query = supabase
      .from('audit_logs')
      .select('*');

    const { data, error } = await query.order('created_at', { ascending: false }).limit(200);
    if (error) return [];
    return data || [];
  }


  static async getProducts(): Promise<Product[]> {
    if (!isSupabaseConfigured) return [];
    const query = supabase
      .from('products')
      .select('*');

    const { data, error } = await query.order('name', { ascending: true });
    if (error) return [];
    return data || [];
  }


  static async getProductById(id: string): Promise<Product | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) return null;
      return data;
    } catch {
      return null;
    }
  }


  static async addProduct(product: Omit<Product, 'id' | 'created_at'>, userName = 'Admin'): Promise<Product> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const userId = await this.getUserId();
    const product_code = await this.getNextSequence('PRODUCT');

    const name = String(product.name || '').trim();
    if (!name) throw new Error('Product name is required');

    // Explicit allowlist: only allow name, category, price; drop all else (role, permissions, id, user_id, status, credits)
    const payload = {
      name,
      category: String(product.category || 'General').trim(),
      price: Math.max(0, Number(product.price || 0)),
      product_code,
      ...(userId ? { user_id: userId } : {})
    };

    const { data, error } = await supabase
      .from('products')
      .insert([payload])
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Failed to create product');

    await this.logAudit({
      user_name: userName,
      action: 'CREATE_PRODUCT',
      entity: `Product ${product.name}`,
      new_value: JSON.stringify(data)
    });

    return data;
  }


  static async updateProduct(id: string, product: Partial<Omit<Product, 'id' | 'created_at'>>, userName = 'Admin'): Promise<Product | null> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    // Explicit allowlist: only allow name, category, price; drop all else (role, permissions, id, user_id, status, credits, product_code, created_at)
    const allowedUpdates: Record<string, unknown> = {};
    if (product.name !== undefined) allowedUpdates.name = String(product.name).trim();
    if (product.category !== undefined) allowedUpdates.category = String(product.category).trim();
    if (product.price !== undefined) allowedUpdates.price = Math.max(0, Number(product.price));

    if (Object.keys(allowedUpdates).length === 0) {
      return this.getProductById(id);
    }

    const { data, error } = await supabase
      .from('products')
      .update(allowedUpdates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      return null;
    }

    await this.logAudit({
      user_name: userName,
      action: 'UPDATE_PRODUCT',
      entity: `Product ${data.name}`,
      new_value: JSON.stringify(data)
    });

    return data;
  }


  static async deleteProduct(id: string, userName = 'Admin'): Promise<boolean> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    // Verify existence
    const existing = await this.getProductById(id);
    if (!existing) {
      return false;
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    await this.logAudit({
      user_name: userName,
      action: 'DELETE_PRODUCT',
      entity: `Product ID ${id}`
    });

    return true;
  }


  static async getCustomers(): Promise<Customer[]> {
    if (!isSupabaseConfigured) return [];
    const query = supabase
      .from('customers')
      .select('*');

    const { data, error } = await query.order('name', { ascending: true });
    if (error) return [];
    const customers = data || [];

    for (const cust of customers) {
      cust.advance_balance = Number(cust.advance_balance || 0);
    }

    return customers;
  }


  static async addCustomer(customer: { name: string; mobile?: string; email?: string }, userName = 'Admin'): Promise<Customer> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const userId = await this.getUserId();

    const cleanName = String(customer.name || '').trim().replace(/\s+/g, ' ');
    if (!cleanName) {
      throw new Error('Customer name is required.');
    }

    // Strict duplicate customer name check (case-insensitive, whitespace-normalized)
    const existingQuery = supabase
      .from('customers')
      .select('*');

    const { data: existingList } = await existingQuery;
    const duplicate = (existingList || []).find(
      c => c.name.trim().replace(/\s+/g, ' ').toLowerCase() === cleanName.toLowerCase()
    );

    if (duplicate) {
      throw new Error(
        `Customer "${duplicate.name}" already exists${duplicate.mobile ? ` (Mobile: ${duplicate.mobile})` : ''}. Duplicate customer names are not allowed.`
      );
    }

    const customer_code = await this.getNextSequence('CUSTOMER');

    const payload = {
      name: cleanName,
      mobile: customer.mobile ? customer.mobile.trim() : null,
      email: customer.email ? customer.email.trim() : null,
      customer_code,
      advance_balance: 0,
      loyalty_points: 0,
      ...(userId ? { user_id: userId } : {})
    };

    const { data, error } = await supabase
      .from('customers')
      .insert([payload])
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Failed to create customer');

    await this.logAudit({
      user_name: userName,
      action: 'CREATE_CUSTOMER',
      entity: `Customer ${cleanName}`,
      new_value: JSON.stringify(data)
    });

    return data;
  }


  static async updateCustomer(id: string, customer: { name: string; mobile?: string; email?: string }, userName = 'Admin'): Promise<Customer | null> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    const cleanName = String(customer.name || '').trim().replace(/\s+/g, ' ');
    if (!cleanName) {
      throw new Error('Customer name is required.');
    }

    // Prevent renaming a customer to another existing customer's name
    const { data: existingList } = await supabase
      .from('customers')
      .select('id, name, mobile');

    const duplicate = (existingList || []).find(
      c => c.id !== id && c.name.trim().replace(/\s+/g, ' ').toLowerCase() === cleanName.toLowerCase()
    );

    if (duplicate) {
      throw new Error(
        `Another customer named "${duplicate.name}" already exists${duplicate.mobile ? ` (Mobile: ${duplicate.mobile})` : ''}. Duplicate customer names are not allowed.`
      );
    }

    const { data, error } = await supabase
      .from('customers')
      .update({
        name: cleanName,
        mobile: customer.mobile ? customer.mobile.trim() : null,
        email: customer.email ? customer.email.trim() : null
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      return null;
    }

    await this.logAudit({
      user_name: userName,
      action: 'UPDATE_CUSTOMER',
      entity: `Customer ${cleanName}`,
      new_value: JSON.stringify(data)
    });

    return data;
  }


  static async getCustomerSummaries(_skipAutoReconcile = false): Promise<CustomerSummary[]> {
    const customers = await this.getCustomers();
    if (!customers.length) return [];

    const [
      { data: bills },
      { data: payments },
      { data: loyaltyTxs }
    ] = await Promise.all([
      supabase.from('bills').select('id, customer_id, paid_by_customer_id, grand_total, paid_total, cash_paid, upi_paid, advance_used, payment_method, created_at'),
      supabase.from('payments').select('id, customer_id, bill_id, amount, status, created_at'),
      supabase.from('loyalty_transactions').select('customer_id, points, type')
    ]);

    const activePayments = (payments || []).filter(p => p.status !== 'CANCELLED' && p.status !== 'REVERSED');

    const computeCustomerNetLedger = (cust: Customer) => {
      // Transfer liability to payer: if bill has paid_by_customer_id, the designated payer carries the debt/bill
      const custBills = (bills || []).filter(b => {
        if (b.paid_by_customer_id) {
          return b.paid_by_customer_id === cust.id;
        }
        return b.customer_id === cust.id;
      });
      const custPayments = activePayments.filter(p => p.customer_id === cust.id);

      const totalBilled = Number(
        custBills.reduce((sum, b) => sum + Number(b.grand_total || 0), 0).toFixed(2)
      );

      const totalPaymentsVouchers = Number(custPayments.reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(2));
      const totalBillPaid = Number(custBills.reduce((s, b) => s + Number(b.paid_total || 0), 0).toFixed(2));
      const totalCustomerPaid = Math.max(totalPaymentsVouchers, totalBillPaid);

      const trueDue = Number(custBills.reduce((s, b) => s + Math.max(0, Number(b.grand_total || 0) - Number(b.paid_total || 0)), 0).toFixed(2));
      const trueAdvance = totalCustomerPaid > totalBilled ? Number((totalCustomerPaid - totalBilled).toFixed(2)) : 0.00;
      const totalPaidDisplay = Math.min(totalBilled, totalCustomerPaid);

      return {
        totalBilled,
        totalPaidDisplay,
        trueAdvance,
        trueDue
      };
    };

    // Auto-sync any discrepant advance & loyalty balances directly to Supabase and keep live customer objects accurate
    let discrepanciesFixedCount = 0;
    for (const cust of customers) {
      const net = computeCustomerNetLedger(cust);
      const custTxs = (loyaltyTxs || []).filter(t => t.customer_id === cust.id);
      const trueLoyalty = Math.max(0, custTxs.reduce((sum, t) => sum + (t.type === 'REDEEM' ? -Math.abs(Number(t.points || 0)) : Number(t.points || 0)), 0));

      const needAdvUpdate = Math.abs(Number(cust.advance_balance || 0) - net.trueAdvance) > 0.001;
      const needLoyUpdate = custTxs.length > 0 && Number(cust.loyalty_points || 0) !== trueLoyalty;

      if (needAdvUpdate || needLoyUpdate) {
        cust.advance_balance = net.trueAdvance;
        if (needLoyUpdate) {
          cust.loyalty_points = trueLoyalty;
        }
        discrepanciesFixedCount++;
        const updatePayload: Record<string, number> = {};
        if (needAdvUpdate) updatePayload.advance_balance = net.trueAdvance;
        if (needLoyUpdate) updatePayload.loyalty_points = trueLoyalty;
        await supabase.from('customers').update(updatePayload).eq('id', cust.id);
      }
    }

    if (discrepanciesFixedCount > 0) {
      this.logAudit({
        user_name: 'System Audit',
        action: 'RECONCILE_CUSTOMER_ADVANCES',
        entity: 'Customer Balances',
        new_value: `Reconciled ${discrepanciesFixedCount} customer advance balance(s) based on ledger transactions.`
      }).catch(() => { });
    }

    return customers.map(cust => {
      const net = computeCustomerNetLedger(cust);

      return {
        id: cust.id,
        user_id: cust.user_id,
        name: cust.name,
        mobile: cust.mobile,
        email: cust.email,
        customer_code: cust.customer_code,
        advance_balance: net.trueAdvance,
        loyalty_points: Number(cust.loyalty_points || 0),
        total_billed: net.totalBilled,
        total_paid: net.totalPaidDisplay,
        balance_due: net.trueDue,
        created_at: cust.created_at
      };
    });
  }


  static async createBill(billData: {
    customer_id?: string | null;
    total: number;
    discount: number;
    rounding_method: RoundingMethod;
    cash_paid: number;
    upi_paid: number;
    advance_used: number;
    points_to_redeem: number;
    payment_method?: PaymentMethod | string;
    items: {
      product_id?: string | null;
      product_name: string;
      quantity: number;
      price: number;
      total: number;
    }[];
  }, userName = 'Admin'): Promise<Bill | null> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const userId = await this.getUserId();

    // 1. Verify customer if provided and cap credits/points to real DB balances
    let verifiedCustomer: Customer | null = null;
    if (billData.customer_id) {
      const custQ = supabase
        .from('customers')
        .select('*')
        .eq('id', billData.customer_id);
      const { data: primaryCust, error: custErr } = await custQ.maybeSingle();
      let custData = primaryCust;

      if (!custData) {
        const { data: fallbackCust } = await supabase.from('customers').select('*').eq('id', billData.customer_id).maybeSingle();
        custData = fallbackCust;
      }

      if (custErr || !custData) {
        return null;
      }

      custData.advance_balance = Number(custData.advance_balance || 0);
      verifiedCustomer = custData;
    }

    const [settings, activeRedemptionRules] = await Promise.all([
      this.getSettings(),
      this.getLoyaltyRedemptionRules()
    ]);

    // 2. Validate line items & lock catalog prices to prevent price tampering
    const productIds = billData.items.filter(i => i.product_id).map(i => i.product_id as string);
    const catalogProductsMap = new Map<string, Product>();
    if (productIds.length > 0) {
      const { data: dbProds } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds);

      if (dbProds) {
        dbProds.forEach(p => catalogProductsMap.set(p.id, p));
      }
    }

    // Explicit allowlist for line items: product_id, product_name, quantity, price, total
    const sanitizedItems = billData.items.map(item => {
      const dbProd = item.product_id ? catalogProductsMap.get(item.product_id) : null;
      const providedPrice = item.price !== undefined && item.price !== null && !isNaN(Number(item.price))
        ? Math.max(0, Number(item.price))
        : null;
      const unitPrice = providedPrice !== null ? providedPrice : (dbProd ? Number(dbProd.price) : 0);
      const qty = Math.max(0.001, Number(item.quantity || 1));
      const lineTotal = Number((qty * unitPrice).toFixed(2));
      return {
        product_id: dbProd ? dbProd.id : null,
        product_name: String(item.product_name || (dbProd ? dbProd.name : 'Item')).trim(),
        quantity: qty,
        price: unitPrice,
        total: lineTotal
      };
    });

    // Subtotal computed strictly from verified line items
    const verifiedSubtotal = Number(sanitizedItems.reduce((acc, it) => acc + it.total, 0).toFixed(2));

    // Cap loyalty points and advance balance to what the customer actually owns (prevents credit forgery)
    const maxRedeemablePoints = verifiedCustomer ? Number(verifiedCustomer.loyalty_points || 0) : 0;
    const pointsToRedeem = Math.max(0, Math.min(Number(billData.points_to_redeem || 0), maxRedeemablePoints));

    const maxAdvanceAllowed = verifiedCustomer ? Number(verifiedCustomer.advance_balance || 0) : 0;
    const advanceUsed = Math.max(0, Math.min(Number(billData.advance_used || 0), maxAdvanceAllowed));

    // Calculate Loyalty Redemption Discount from active rules
    const redemptionDiscount = this.calculateLoyaltyDiscount(pointsToRedeem, settings.loyalty, activeRedemptionRules);
    const userDiscount = Math.max(0, Number(billData.discount || 0));
    const totalDiscountApplied = userDiscount + redemptionDiscount;

    // Calculate Subtotal after discount and optional GST
    const subtotalAfterDiscount = Math.max(0, verifiedSubtotal - totalDiscountApplied);
    let gstAmount = 0;
    if (settings.billing.gst_enabled && Number(settings.billing.gst_rate) > 0) {
      gstAmount = Number(((subtotalAfterDiscount * Number(settings.billing.gst_rate)) / 100).toFixed(2));
    }
    const totalBeforeRounding = subtotalAfterDiscount + gstAmount;

    const { roundedTotal, roundingAdjustment } = this.calculateRounding(totalBeforeRounding, billData.rounding_method);
    const grandTotal = roundedTotal;

    const directCashPaid = Math.max(0, Number(billData.cash_paid || 0));
    const directUpiPaid = Math.max(0, Number(billData.upi_paid || 0));
    const totalDirectPaid = directCashPaid + directUpiPaid;

    // 1. Advance used applies directly to THIS bill
    const thisBillAdvanceUsed = Math.min(grandTotal, advanceUsed);
    const balanceAfterAdvance = Math.max(0, grandTotal - thisBillAdvanceUsed);

    // Determine primary payment method
    let primaryPaymentMethod: PaymentMethod = 'Cash';
    if (directUpiPaid > 0 && directCashPaid === 0) {
      primaryPaymentMethod = 'UPI';
    } else if (directCashPaid > 0 && directUpiPaid === 0) {
      primaryPaymentMethod = 'Cash';
    } else if (directCashPaid > 0 && directUpiPaid > 0) {
      primaryPaymentMethod = 'Split Payment';
    } else if (thisBillAdvanceUsed > 0 && directCashPaid === 0 && directUpiPaid === 0) {
      primaryPaymentMethod = thisBillAdvanceUsed >= grandTotal - 0.01 ? 'Advance Used' : ((billData.payment_method as PaymentMethod) || 'Pay Later');
    } else if (totalDirectPaid === 0 && thisBillAdvanceUsed === 0) {
      primaryPaymentMethod = (billData.payment_method as PaymentMethod) || 'Pay Later';
    } else if (billData.payment_method) {
      primaryPaymentMethod = billData.payment_method as PaymentMethod;
    }

    // 2. Direct payments (Cash / UPI) apply to remainder of this bill
    const thisBillDirectPaid = Math.min(balanceAfterAdvance, totalDirectPaid);
    const paidTotal = Number((thisBillAdvanceUsed + thisBillDirectPaid).toFixed(2));
    const excessDirectPaid = Math.max(0, totalDirectPaid - thisBillDirectPaid);
    let advanceEarned = 0;
    let pointsEarnedFromOlderBills = 0;

    // 3. Excess direct cash/UPI payment can auto-clear older unpaid bills or earn advance
    if (billData.customer_id && excessDirectPaid > 0) {
      const olderBillsQuery = supabase
        .from('bills')
        .select('*')
        .eq('customer_id', billData.customer_id);

      const { data: olderBills } = await olderBillsQuery.order('created_at', { ascending: true });

      const unpaidOlderBills = (olderBills || []).filter(b => Number(b.paid_total || 0) < Number(b.grand_total || 0));

      let availablePayment = excessDirectPaid;

      for (const oldBill of unpaidOlderBills) {
        if (availablePayment <= 0) break;
        const oldGrandTotal = Number(oldBill.grand_total || 0);
        const due = oldGrandTotal - Number(oldBill.paid_total || 0);
        const allocate = Math.min(due, availablePayment);
        const newPaidTotal = Number((Number(oldBill.paid_total || 0) + allocate).toFixed(2));
        const isOldBillNowFullyPaid = newPaidTotal >= oldGrandTotal - 0.01;

        const oldCash = Number(oldBill.cash_paid || 0);
        const oldUpi = Number(oldBill.upi_paid || 0);
        let updatedCash = oldCash;
        let updatedUpi = oldUpi;
        const allocMethod = (directUpiPaid > 0 && directCashPaid === 0) ? 'UPI' : (directCashPaid > 0 && directUpiPaid === 0) ? 'Cash' : primaryPaymentMethod;

        if (allocMethod === 'UPI') updatedUpi += allocate;
        else if (allocMethod === 'Cash') updatedCash += allocate;

        let updatedMethod = oldBill.payment_method;
        if (updatedUpi > 0 && updatedCash === 0) updatedMethod = 'UPI';
        else if (updatedCash > 0 && updatedUpi === 0) updatedMethod = 'Cash';
        else if (updatedCash > 0 && updatedUpi > 0) updatedMethod = 'Split Payment';

        const oldBillUpdate: Record<string, unknown> = {
          paid_total: newPaidTotal,
          cash_paid: updatedCash,
          upi_paid: updatedUpi,
          payment_method: updatedMethod
        };

        if (isOldBillNowFullyPaid && Number(oldBill.loyalty_points_earned || 0) === 0 && oldGrandTotal > 0) {
          const oldPts = await this.calculateLoyaltyPointsEarned(oldGrandTotal);
          if (oldPts > 0) {
            const loySeq = await this.getNextSequence('LOYALTY');
            await supabase.from('loyalty_transactions').insert([{
              transaction_number: loySeq,
              customer_id: billData.customer_id,
              bill_id: oldBill.id,
              points: oldPts,
              type: 'EARN',
              notes: `Award Reason: Bill Fully Paid - ${oldBill.bill_number}`,
              ...(userId ? { user_id: userId } : {})
            }]);
            oldBillUpdate.loyalty_points_earned = oldPts;
            pointsEarnedFromOlderBills += oldPts;
          }
        }

        await supabase
          .from('bills')
          .update(oldBillUpdate)
          .eq('id', oldBill.id);

        const pSeq = await this.getNextSequence('PAYMENT');
        await supabase.from('payments').insert([{
          payment_number: pSeq,
          customer_id: billData.customer_id,
          bill_id: oldBill.id,
          amount: allocate,
          payment_method: allocMethod,
          status: 'COMPLETED',
          notes: `Payment auto-cleared against outstanding Bill ${oldBill.bill_number}`,
          ...(userId ? { user_id: userId } : {})
        }]);

        availablePayment -= allocate;
      }

      if (availablePayment > 0) {
        advanceEarned = Number(availablePayment.toFixed(2));
      }
    } else if (excessDirectPaid > 0) {
      advanceEarned = Number(excessDirectPaid.toFixed(2));
    }

    if (paidTotal < grandTotal - 0.01 && directCashPaid === 0 && directUpiPaid === 0) {
      primaryPaymentMethod = 'Pay Later';
    }

    const bill_number = await this.getNextSequence('BILL');

    // Explicit allowlist: bill payload constructed only with permitted fields; drops user_id override, IDs, status, roles
    const billPayload = {
      bill_number,
      customer_id: billData.customer_id || null,
      total: verifiedSubtotal,
      discount: totalDiscountApplied,
      gst_amount: gstAmount,
      rounding_method: billData.rounding_method,
      rounding_adjustment: roundingAdjustment,
      grand_total: grandTotal,
      cash_paid: directCashPaid,
      upi_paid: directUpiPaid,
      paid_total: paidTotal,
      advance_used: thisBillAdvanceUsed,
      advance_earned: advanceEarned,
      payment_method: primaryPaymentMethod,
      loyalty_points_earned: 0,
      loyalty_points_redeemed: pointsToRedeem,
      ...(userId ? { user_id: userId } : {})
    };

    const { data: bill, error: billErr } = await supabase
      .from('bills')
      .insert([billPayload])
      .select('*, customers!fk_bills_customer(name, mobile, email)')
      .maybeSingle();

    if (billErr) throw new Error(billErr.message);
    if (!bill) throw new Error('Failed to create bill');

    const itemsToInsert = sanitizedItems.map(item => ({
      bill_id: bill.id,
      product_id: item.product_id || null,
      product_name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
      ...(userId ? { user_id: userId } : {})
    }));

    await this.insertBillItemsWithFallback(itemsToInsert);

    const currentBillPaymentAmount = Number((thisBillDirectPaid + advanceEarned).toFixed(2));
    if (billData.customer_id && currentBillPaymentAmount > 0) {
      const paySeq = await this.getNextSequence('PAYMENT');
      const { error: payErr } = await supabase.from('payments').insert([{
        payment_number: paySeq,
        customer_id: billData.customer_id,
        bill_id: bill.id,
        amount: currentBillPaymentAmount,
        payment_method: primaryPaymentMethod,
        status: 'COMPLETED',
        notes: advanceEarned > 0
          ? `Initial payment for Bill ${bill.bill_number} (₹${thisBillDirectPaid.toFixed(2)} + ₹${advanceEarned.toFixed(2)} advance earned)`
          : `Initial payment for Bill ${bill.bill_number}`,
        ...(userId ? { user_id: userId } : {})
      }]);
      if (payErr) {
        console.error('Failed to insert initial payment record for bill:', payErr);
      }
    }

    if (billData.customer_id && paidTotal >= grandTotal - 0.01 && grandTotal > 0) {
      const pointsEarned = await this.calculateLoyaltyPointsEarned(grandTotal);
      if (pointsEarned > 0) {
        const loySeq = await this.getNextSequence('LOYALTY');
        await supabase.from('loyalty_transactions').insert([{
          transaction_number: loySeq,
          customer_id: billData.customer_id,
          bill_id: bill.id,
          points: pointsEarned,
          type: 'EARN',
          notes: `Award Reason: Bill Fully Paid - ${bill.bill_number}`,
          ...(userId ? { user_id: userId } : {})
        }]);

        await supabase
          .from('bills')
          .update({ loyalty_points_earned: pointsEarned })
          .eq('id', bill.id);
        bill.loyalty_points_earned = pointsEarned;
      }
    }

    if (billData.customer_id && pointsToRedeem > 0) {
      const redSeq = await this.getNextSequence('LOYALTY');
      await supabase.from('loyalty_transactions').insert([{
        transaction_number: redSeq,
        customer_id: billData.customer_id,
        bill_id: bill.id,
        points: -pointsToRedeem,
        type: 'REDEEM',
        notes: `Redemption: Redeemed on Bill ${bill.bill_number} (Discount: ₹${redemptionDiscount})`,
        ...(userId ? { user_id: userId } : {})
      }]);
    }

    if (billData.customer_id && verifiedCustomer) {
      const currentAdvance = Number(verifiedCustomer.advance_balance || 0);
      const currentLoyalty = Number(verifiedCustomer.loyalty_points || 0);
      const pointsEarnedNow = (bill.loyalty_points_earned || 0) + pointsEarnedFromOlderBills;

      const newAdvance = Number(Math.max(0, currentAdvance - thisBillAdvanceUsed + advanceEarned).toFixed(2));
      const newLoyalty = Math.max(0, currentLoyalty - pointsToRedeem + pointsEarnedNow);

      await supabase.from('customers').update({
        advance_balance: newAdvance,
        loyalty_points: newLoyalty
      }).eq('id', billData.customer_id);
    }

    await this.logAudit({
      user_name: userName,
      action: 'CREATE_BILL',
      entity: `Bill ${bill.bill_number}`,
      new_value: `Grand Total: ₹${grandTotal}, Paid: ₹${paidTotal}, Advance Earned: ₹${advanceEarned}`
    });

    return this.formatBillRow({
      ...bill,
      items: sanitizedItems.map((item, idx) => ({
        id: `temp-${idx}`,
        bill_id: bill.id,
        product_id: item.product_id || null,
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        created_at: new Date().toISOString()
      }))
    });
  }


  public static formatBillRow(row: Record<string, unknown> | null | undefined): Bill {
    if (!row) return row as unknown as Bill;
    const custRaw = row.customers;
    const cust = Array.isArray(custRaw) ? custRaw[0] : (custRaw as Record<string, unknown> | undefined);
    const rawItems = (row.items || row.bill_items || []) as Array<Record<string, unknown>>;
    const formattedItems: BillItem[] = rawItems.map((it) => ({
      id: it.id as string | undefined,
      user_id: it.user_id as string | null | undefined,
      bill_id: it.bill_id as string | undefined,
      product_id: (it.product_id as string | null | undefined) ?? null,
      product_name: String((it.product_name && it.product_name !== 'Custom Item') ? it.product_name : (it.item_name || it.product_name || '')),
      price: Number(it.price ?? it.unit_price ?? 0),
      quantity: Number(it.quantity ?? it.qty ?? 0),
      total: Number(it.total ?? it.amount ?? 0),
      created_at: it.created_at as string | undefined
    }));

    const cash = Number(row.cash_paid || 0);
    const upi = Number(row.upi_paid || 0);
    const adv = Number(row.advance_used || 0);
    const paid = Number(row.paid_total || 0);

    let resolvedPaymentMethod = row.payment_method as string | undefined;
    if (!resolvedPaymentMethod || resolvedPaymentMethod === 'Cash' || resolvedPaymentMethod === 'Auto-Allocation') {
      if (upi > 0 && cash === 0) resolvedPaymentMethod = 'UPI';
      else if (cash > 0 && upi === 0) resolvedPaymentMethod = 'Cash';
      else if (cash > 0 && upi > 0) resolvedPaymentMethod = 'Split Payment';
      else if (adv > 0 && cash === 0 && upi === 0) resolvedPaymentMethod = 'Advance Used';
      else if (paid <= 0.01 && (!resolvedPaymentMethod || resolvedPaymentMethod === 'Cash' || resolvedPaymentMethod === 'Auto-Allocation')) resolvedPaymentMethod = 'Pay Later';
    }

    return {
      ...(row as unknown as Bill),
      customer_name: (row.customer_name as string | undefined) || (cust?.name as string | undefined) || ((row.customer_id as string | undefined) ? 'Customer' : 'Walk-in Customer'),
      customer_mobile: (row.customer_mobile as string | null | undefined) ?? (cust?.mobile as string | null | undefined) ?? null,
      customer_email: (row.customer_email as string | null | undefined) ?? (cust?.email as string | null | undefined) ?? null,
      advance_used: adv,
      paid_total: paid,
      cash_paid: cash,
      upi_paid: upi,
      payment_method: resolvedPaymentMethod || 'Cash',
      items: formattedItems
    };
  }


  static async editBillDiscount(billId: string, newDiscount: number, reason: string, userName = 'Super Admin'): Promise<Bill | null> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    const bill = await this.getBillById(billId);
    if (!bill) return null;

    const settings = await this.getSettings();
    const subtotalAfterDiscount = Math.max(0, Number(bill.total || 0) - newDiscount);

    let newGstAmount = 0;
    if (settings.billing.gst_enabled && Number(settings.billing.gst_rate) > 0) {
      const rate = Number(settings.billing.gst_rate);
      newGstAmount = Number(((subtotalAfterDiscount * rate) / 100).toFixed(2));
    } else if (Number(bill.gst_amount || 0) > 0 && Number(bill.total || 0) > 0) {
      const prevNet = Math.max(1, Number(bill.total || 0) - Number(bill.discount || 0));
      const priorRate = (Number(bill.gst_amount) / prevNet) * 100;
      newGstAmount = Number(((subtotalAfterDiscount * priorRate) / 100).toFixed(2));
    }

    const preRoundTotal = subtotalAfterDiscount + newGstAmount;
    const { roundedTotal: newGrandTotal, roundingAdjustment: newAdjustment } = this.calculateRounding(
      preRoundTotal,
      (bill.rounding_method as RoundingMethod) || 'None'
    );

    const prevPaidTotal = Number(bill.paid_total || 0);
    const prevAdvanceEarned = Number(bill.advance_earned || 0);
    let updatedPaidTotal = prevPaidTotal;
    let updatedAdvanceEarned = prevAdvanceEarned;
    let excessCreditFromDiscount = 0;

    if (prevPaidTotal > newGrandTotal) {
      excessCreditFromDiscount = Number((prevPaidTotal - newGrandTotal).toFixed(2));
      updatedPaidTotal = newGrandTotal;
      updatedAdvanceEarned = Number((prevAdvanceEarned + excessCreditFromDiscount).toFixed(2));
    }

    const { data: updatedBill, error } = await supabase
      .from('bills')
      .update({
        discount: newDiscount,
        gst_amount: newGstAmount,
        rounding_adjustment: newAdjustment,
        grand_total: newGrandTotal,
        paid_total: updatedPaidTotal,
        advance_earned: updatedAdvanceEarned,
        edited_at: new Date().toISOString(),
        edited_by: userName,
        edit_reason: reason
      })
      .eq('id', billId)
      .select('*, customers!fk_bills_customer(name, mobile, email)')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!updatedBill) return null;

    if (bill.customer_id && excessCreditFromDiscount > 0) {
      const { data: cust } = await supabase
        .from('customers')
        .select('advance_balance')
        .eq('id', bill.customer_id)
        .maybeSingle();

      if (cust) {
        const newAdv = Number((Number(cust.advance_balance || 0) + excessCreditFromDiscount).toFixed(2));
        await supabase
          .from('customers')
          .update({ advance_balance: newAdv })
          .eq('id', bill.customer_id);
      }
    }

    if (bill.customer_id && updatedPaidTotal >= newGrandTotal - 0.01 && newGrandTotal > 0 && Number(bill.loyalty_points_earned || 0) === 0) {
      await this.processBillFullPaymentLoyalty(billId);
    }

    await this.logAudit({
      user_name: userName,
      action: 'EDIT_BILL_DISCOUNT',
      entity: `Bill ${updatedBill.bill_number}`,
      previous_value: `Discount: ₹${bill.discount}, Grand Total: ₹${bill.grand_total}`,
      new_value: `New Discount: ₹${newDiscount}, New Grand Total: ₹${newGrandTotal}, Reason: ${reason}`
    });

    return this.formatBillRow(updatedBill);
  }


  static async editFullBill(billId: string, input: EditBillInput): Promise<Bill | null> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    const bill = await this.getBillById(billId);
    if (!bill) throw new Error('Bill not found');

    const settings = await this.getSettings();
    const userName = input.userName || 'Super Admin';

    // 1. Calculate items total
    const subtotal = Number(input.items.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.price || 0)), 0).toFixed(2));
    const discount = Math.max(0, Number(input.discount || 0));
    const subtotalAfterDiscount = Math.max(0, subtotal - discount);

    let newGstAmount = 0;
    if (settings.billing.gst_enabled && Number(settings.billing.gst_rate) > 0) {
      const rate = Number(settings.billing.gst_rate);
      newGstAmount = Number(((subtotalAfterDiscount * rate) / 100).toFixed(2));
    }

    const preRoundTotal = subtotalAfterDiscount + newGstAmount;
    const { roundedTotal: newGrandTotal, roundingAdjustment: newAdjustment } = this.calculateRounding(
      preRoundTotal,
      input.rounding_method || (bill.rounding_method as RoundingMethod) || 'None'
    );

    const cashPaid = Number(input.cash_paid || 0);
    const upiPaid = Number(input.upi_paid || 0);
    const advUsed = Number(input.advance_used || 0);
    let totalPaid = Number((cashPaid + upiPaid + advUsed).toFixed(2));

    let advanceEarned = 0;
    if (totalPaid > newGrandTotal) {
      advanceEarned = Number((totalPaid - newGrandTotal).toFixed(2));
      totalPaid = newGrandTotal;
    }

    // 2. Update bills record
    const { data: updatedBill, error: billErr } = await supabase
      .from('bills')
      .update({
        customer_id: input.customer_id || null,
        total: subtotal,
        discount: discount,
        gst_amount: newGstAmount,
        rounding_adjustment: newAdjustment,
        grand_total: newGrandTotal,
        cash_paid: cashPaid,
        upi_paid: upiPaid,
        advance_used: advUsed,
        advance_earned: advanceEarned,
        paid_total: totalPaid,
        payment_method: input.payment_method || 'Pay Later',
        edited_at: new Date().toISOString(),
        edited_by: userName,
        edit_reason: input.reason
      })
      .eq('id', billId)
      .select('*, customers!fk_bills_customer(name, mobile, email)')
      .maybeSingle();

    if (billErr) throw new Error(billErr.message);

    // 3. Delete old items and insert updated items
    await supabase.from('bill_items').delete().eq('bill_id', billId);

    const sanitizedItems = input.items.map(it => ({
      bill_id: billId,
      product_id: it.product_id || null,
      product_name: it.product_name,
      quantity: Number(it.quantity || 1),
      price: Number(it.price || 0),
      total: Number((Number(it.quantity || 1) * Number(it.price || 0)).toFixed(2))
    }));

    if (sanitizedItems.length > 0) {
      try {
        await this.insertBillItemsWithFallback(sanitizedItems);
      } catch (itemsErr) {
        console.error('Error inserting updated bill items:', itemsErr);
      }
    }

    // 4. Log audit entry
    await this.logAudit({
      user_name: userName,
      action: 'EDIT_BILL',
      entity: `Bill ${bill.bill_number}`,
      previous_value: `Items: ${bill.items?.length || 0}, Grand Total: ₹${bill.grand_total}, Paid: ₹${bill.paid_total}`,
      new_value: `Items: ${sanitizedItems.length}, Grand Total: ₹${newGrandTotal}, Paid: ₹${totalPaid}, Reason: ${input.reason}`
    });

    return this.formatBillRow({
      ...updatedBill,
      items: sanitizedItems,
      bill_items: sanitizedItems
    });
  }


  static async getBills(): Promise<Bill[]> {
    if (!isSupabaseConfigured) return [];
    const query = supabase
      .from('bills')
      .select('*, customers!fk_bills_customer(name, mobile, email)');

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return (data || []).map(b => this.formatBillRow(b));
  }


  static async getBillsByDateRange(filter: DateFilterOption, customRange?: { from: string; to: string }): Promise<Bill[]> {
    if (!isSupabaseConfigured) return [];

    let query = supabase
      .from('bills')
      .select('*, customers!fk_bills_customer(name, mobile, email), bill_items(*)');

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (filter === 'current_session') {
      const latestClosing = await this.getLatestAccountingClosing();
      if (latestClosing?.to_date) {
        startDate = new Date(latestClosing.to_date);
      }
    } else {
      const bounds = this.getDateRangeBounds(filter, customRange);
      startDate = bounds.startDate;
      endDate = bounds.endDate;
    }

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching bills by date range:', error);
      return [];
    }
    return (data || []).map(b => this.formatBillRow(b));
  }


  static async getBillById(id: string): Promise<Bill | null> {
    if (!isSupabaseConfigured) return null;

    const { data: bill, error: billErr } = await supabase
      .from('bills')
      .select('*, customers!fk_bills_customer(name, mobile, email)')
      .eq('id', id)
      .maybeSingle();

    if (billErr || !bill) return null;

    const { data: items, error: itemsErr } = await supabase
      .from('bill_items')
      .select('*')
      .eq('bill_id', id);

    if (itemsErr) return null;

    return this.formatBillRow({
      ...bill,
      items: items || [],
      bill_items: items || []
    });
  }

  // --- GROUP BILLING ENGINE (SPLIT & SHARED BILLING) ---

  static async createSplitBilling(input: CreateSplitBillingInput, userName = 'Admin'): Promise<GroupBill> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    if (!input.customer_ids || input.customer_ids.length === 0) {
      throw new Error('At least one customer must be selected for Split Billing.');
    }
    if (!input.items || input.items.length === 0) {
      throw new Error('At least one item must be added to the cart.');
    }

    const userId = await this.getUserId();
    const groupBillNumber = await this.getNextSequence('GROUP_BILL');
    const settings = await this.getSettings();

    // 1. Fetch all selected customers
    const { data: dbCustomers } = await supabase
      .from('customers')
      .select('*')
      .in('id', input.customer_ids);

    const custMap = new Map<string, Customer>();
    (dbCustomers || []).forEach(c => custMap.set(c.id, { ...c, advance_balance: Number(c.advance_balance || 0) }));

    // 2. Validate line items
    const productIds = input.items.filter(i => i.product_id).map(i => i.product_id as string);
    const catalogProductsMap = new Map<string, Product>();
    if (productIds.length > 0) {
      const { data: dbProds } = await supabase.from('products').select('*').in('id', productIds);
      (dbProds || []).forEach(p => catalogProductsMap.set(p.id, p));
    }

    const sanitizedItems = input.items.map(item => {
      const dbProd = item.product_id ? catalogProductsMap.get(item.product_id) : null;
      const unitPrice = item.price !== undefined ? Math.max(0, Number(item.price)) : (dbProd ? Number(dbProd.price) : 0);
      const qty = Math.max(0.001, Number(item.quantity || 1));
      const lineTotal = Number((qty * unitPrice).toFixed(2));
      return {
        product_id: dbProd ? dbProd.id : null,
        product_name: String(item.product_name || (dbProd ? dbProd.name : 'Item')).trim(),
        quantity: qty,
        price: unitPrice,
        total: lineTotal
      };
    });

    const singleCartSubtotal = Number(sanitizedItems.reduce((acc, it) => acc + it.total, 0).toFixed(2));
    const discountPerCustomer = Math.max(0, Number(input.discount_per_customer || 0));
    const subtotalAfterDiscount = Math.max(0, singleCartSubtotal - discountPerCustomer);

    let gstAmount = 0;
    if (settings.billing.gst_enabled && Number(settings.billing.gst_rate) > 0) {
      gstAmount = Number(((subtotalAfterDiscount * Number(settings.billing.gst_rate)) / 100).toFixed(2));
    }
    const totalBeforeRounding = subtotalAfterDiscount + gstAmount;
    const roundingMethod = input.rounding_method || settings.billing.rounding_method || 'None';
    const { roundedTotal: customerGrandTotal, roundingAdjustment } = this.calculateRounding(totalBeforeRounding, roundingMethod);

    // 3. Create parent group_bills record
    const totalGroupAmount = singleCartSubtotal * input.customer_ids.length;
    const totalGroupDiscount = discountPerCustomer * input.customer_ids.length;
    const initialGroupGrandTotal = customerGrandTotal * input.customer_ids.length;

    const { data: groupBill, error: grpErr } = await supabase
      .from('group_bills')
      .insert([{
        group_bill_number: groupBillNumber,
        billing_type: 'SPLIT',
        total_amount: totalGroupAmount,
        discount: totalGroupDiscount,
        grand_total: initialGroupGrandTotal,
        paid_amount: 0,
        balance_due: initialGroupGrandTotal,
        participant_count: input.customer_ids.length,
        primary_payer_id: input.customer_ids[0],
        status: 'COMPLETED',
        notes: input.notes || null,
        ...(userId ? { user_id: userId } : {})
      }])
      .select()
      .maybeSingle();

    if (grpErr || !groupBill) throw new Error(grpErr?.message || 'Failed to initialize Group Bill');

    let totalGroupPaid = 0;
    const createdBills: Bill[] = [];

    // 4. Create individual bill for each customer
    for (const custId of input.customer_ids) {
      const cust = custMap.get(custId);
      const custAdvance = Number(cust?.advance_balance || 0);
      const override = input.payments_override?.[custId];

      const useAdvance = override?.use_advance !== undefined ? override.use_advance : true;
      const advanceUsed = useAdvance ? Math.min(custAdvance, customerGrandTotal) : 0;
      const balanceAfterAdv = Math.max(0, customerGrandTotal - advanceUsed);

      const cashPaid = Math.max(0, Number(override?.cash_paid || 0));
      const upiPaid = Math.max(0, Number(override?.upi_paid || 0));
      const directPaid = Math.min(balanceAfterAdv, cashPaid + upiPaid);
      const paidTotal = Number((advanceUsed + directPaid).toFixed(2));
      totalGroupPaid += paidTotal;

      let paymentMethod = override?.payment_method || 'Pay Later';
      if (!override?.payment_method) {
        if (paidTotal >= customerGrandTotal - 0.01) {
          if (advanceUsed >= customerGrandTotal - 0.01) paymentMethod = 'Advance Used';
          else if (upiPaid > 0 && cashPaid === 0) paymentMethod = 'UPI';
          else if (cashPaid > 0 && upiPaid === 0) paymentMethod = 'Cash';
          else if (cashPaid > 0 && upiPaid > 0) paymentMethod = 'Split Payment';
          else paymentMethod = 'Cash';
        } else if (paidTotal > 0) {
          paymentMethod = cashPaid > 0 && upiPaid > 0 ? 'Split Payment' : (upiPaid > 0 ? 'UPI' : 'Cash');
        } else {
          paymentMethod = 'Pay Later';
        }
      }

      const billNumber = await this.getNextSequence('BILL');

      const { data: bill, error: billErr } = await supabase
        .from('bills')
        .insert([{
          bill_number: billNumber,
          customer_id: custId,
          group_bill_id: groupBill.id,
          group_role: 'MEMBER',
          total: singleCartSubtotal,
          discount: discountPerCustomer,
          gst_amount: gstAmount,
          rounding_method: roundingMethod,
          rounding_adjustment: roundingAdjustment,
          grand_total: customerGrandTotal,
          cash_paid: cashPaid,
          upi_paid: upiPaid,
          paid_total: paidTotal,
          advance_used: advanceUsed,
          advance_earned: 0,
          payment_method: paymentMethod,
          status: 'COMPLETED',
          notes: input.notes ? `Split Bill (${groupBillNumber}): ${input.notes}` : `Split Bill (${groupBillNumber})`,
          ...(userId ? { user_id: userId } : {})
        }])
        .select('*, customers!fk_bills_customer(name, mobile, email)')
        .maybeSingle();

      if (billErr || !bill) throw new Error(billErr?.message || `Failed to create bill for customer ${custId}`);

      // Insert line items
      const itemsToInsert = sanitizedItems.map(it => ({
        bill_id: bill.id,
        product_id: it.product_id || null,
        product_name: it.product_name,
        quantity: it.quantity,
        price: it.price,
        total: it.total,
        ...(userId ? { user_id: userId } : {})
      }));
      await this.insertBillItemsWithFallback(itemsToInsert);

      // Create payment receipt if paid directly
      if (directPaid > 0) {
        const paySeq = await this.getNextSequence('PAYMENT');
        await supabase.from('payments').insert([{
          payment_number: paySeq,
          customer_id: custId,
          bill_id: bill.id,
          amount: directPaid,
          payment_method: paymentMethod,
          status: 'COMPLETED',
          notes: `Split Bill initial payment - ${billNumber} (${groupBillNumber})`,
          ...(userId ? { user_id: userId } : {})
        }]);
      }

      // Update customer's advance balance if advance was used
      if (advanceUsed > 0 && cust) {
        const newAdv = Math.max(0, custAdvance - advanceUsed);
        await supabase.from('customers').update({ advance_balance: newAdv }).eq('id', custId);
        cust.advance_balance = newAdv;
      }

      // Award loyalty points to customer if bill is fully paid
      if (paidTotal >= customerGrandTotal - 0.01 && settings.loyalty.enabled) {
        const pointsEarned = await this.calculateLoyaltyPointsEarned(paidTotal);
        if (pointsEarned > 0) {
          const loySeq = await this.getNextSequence('LOYALTY');
          await supabase.from('loyalty_transactions').insert([{
            transaction_number: loySeq,
            customer_id: custId,
            bill_id: bill.id,
            points: pointsEarned,
            type: 'EARN',
            notes: `Split Bill Loyalty (${groupBillNumber}): ${billNumber}`,
            ...(userId ? { user_id: userId } : {})
          }]);
          const { data: cRec } = await supabase.from('customers').select('loyalty_points').eq('id', custId).maybeSingle();
          if (cRec) {
            const newLoyalty = Number((Number(cRec.loyalty_points || 0) + pointsEarned).toFixed(2));
            await supabase.from('customers').update({ loyalty_points: newLoyalty }).eq('id', custId);
          }
          await supabase.from('bills').update({ loyalty_points_earned: pointsEarned }).eq('id', bill.id);
          bill.loyalty_points_earned = pointsEarned;
        }
      }

      createdBills.push(this.formatBillRow({
        ...bill,
        items: itemsToInsert
      }));
    }

    // 5. Update parent group_bill with final paid & balance amounts
    const finalGroupGrandTotal = customerGrandTotal * input.customer_ids.length;
    const finalGroupBalanceDue = Math.max(0, finalGroupGrandTotal - totalGroupPaid);
    await supabase.from('group_bills').update({
      paid_amount: totalGroupPaid,
      balance_due: finalGroupBalanceDue
    }).eq('id', groupBill.id);

    await this.logAudit({
      user_name: userName,
      action: 'CREATE_SPLIT_BILLING',
      entity: `Group Bill ${groupBillNumber}`,
      new_value: `Customers: ${input.customer_ids.length}, Grand Total: ₹${finalGroupGrandTotal}, Paid: ₹${totalGroupPaid}`
    });

    return {
      ...groupBill,
      paid_amount: totalGroupPaid,
      balance_due: finalGroupBalanceDue,
      bills: createdBills
    };
  }

  static async createSharedBilling(input: CreateSharedBillingInput, userName = 'Admin'): Promise<GroupBill> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    if (!input.participants || input.participants.length === 0) {
      throw new Error('At least one participant must be specified for Shared Billing.');
    }
    if (!input.items || input.items.length === 0) {
      throw new Error('At least one item must be added to the shared order.');
    }

    const userId = await this.getUserId();
    const groupBillNumber = await this.getNextSequence('GROUP_BILL');
    const settings = await this.getSettings();

    // 1. Validate master line items
    const productIds = input.items.filter(i => i.product_id).map(i => i.product_id as string);
    const catalogProductsMap = new Map<string, Product>();
    if (productIds.length > 0) {
      const { data: dbProds } = await supabase.from('products').select('*').in('id', productIds);
      (dbProds || []).forEach(p => catalogProductsMap.set(p.id, p));
    }

    const sanitizedMasterItems = input.items.map(item => {
      const dbProd = item.product_id ? catalogProductsMap.get(item.product_id) : null;
      const unitPrice = item.price !== undefined ? Math.max(0, Number(item.price)) : (dbProd ? Number(dbProd.price) : 0);
      const qty = Math.max(0.001, Number(item.quantity || 1));
      const lineTotal = Number((qty * unitPrice).toFixed(2));
      return {
        product_id: dbProd ? dbProd.id : null,
        product_name: String(item.product_name || (dbProd ? dbProd.name : 'Item')).trim(),
        quantity: qty,
        price: unitPrice,
        total: lineTotal
      };
    });

    const masterSubtotal = Number(sanitizedMasterItems.reduce((acc, it) => acc + it.total, 0).toFixed(2));
    const groupDiscount = Math.max(0, Number(input.discount || 0));
    const subtotalAfterDiscount = Math.max(0, masterSubtotal - groupDiscount);

    let gstAmount = 0;
    if (settings.billing.gst_enabled && Number(settings.billing.gst_rate) > 0) {
      gstAmount = Number(((subtotalAfterDiscount * Number(settings.billing.gst_rate)) / 100).toFixed(2));
    }
    const totalBeforeRounding = subtotalAfterDiscount + gstAmount;
    const roundingMethod = input.rounding_method || settings.billing.rounding_method || 'None';
    const { roundedTotal: groupGrandTotal } = this.calculateRounding(totalBeforeRounding, roundingMethod);

    // 2. Fetch involved registered customers (participants and payers)
    const involvedCustomerIds = new Set<string>();
    input.participants.forEach(p => {
      if (p.customer_id) involvedCustomerIds.add(p.customer_id);
      if (p.paid_by_customer_id) involvedCustomerIds.add(p.paid_by_customer_id);
      if (p.liability_payer_id) involvedCustomerIds.add(p.liability_payer_id);
    });
    if (input.primary_payer_id) involvedCustomerIds.add(input.primary_payer_id);

    const custMap = new Map<string, Customer>();
    if (involvedCustomerIds.size > 0) {
      const { data: dbCustomers } = await supabase
        .from('customers')
        .select('*')
        .in('id', Array.from(involvedCustomerIds));

      (dbCustomers || []).forEach(c => custMap.set(c.id, { ...c, advance_balance: Number(c.advance_balance || 0) }));
    }

    // 3. Create parent group_bills record
    const primaryPayerId = input.primary_payer_id || input.participants.find(p => p.customer_id)?.customer_id || null;

    const { data: groupBill, error: grpErr } = await supabase
      .from('group_bills')
      .insert([{
        group_bill_number: groupBillNumber,
        billing_type: 'SHARED',
        total_amount: masterSubtotal,
        discount: groupDiscount,
        grand_total: groupGrandTotal,
        paid_amount: 0,
        balance_due: groupGrandTotal,
        participant_count: input.participants.length,
        primary_payer_id: primaryPayerId,
        status: 'COMPLETED',
        notes: input.notes || null,
        ...(userId ? { user_id: userId } : {})
      }])
      .select()
      .maybeSingle();

    if (grpErr || !groupBill) throw new Error(grpErr?.message || 'Failed to initialize Shared Group Bill');

    // 4. Insert master items into group_bill_items
    const masterItemsToInsert = sanitizedMasterItems.map(it => ({
      group_bill_id: groupBill.id,
      product_id: it.product_id || null,
      product_name: it.product_name,
      quantity: it.quantity,
      price: it.price,
      total: it.total,
      ...(userId ? { user_id: userId } : {})
    }));
    await supabase.from('group_bill_items').insert(masterItemsToInsert);

    // 5. Generate child bills for each participant
    let totalGroupPaid = 0;
    const createdBills: Bill[] = [];
    const itemsSummaryText = sanitizedMasterItems.map(i => `${i.quantity}x ${i.product_name}`).join(', ');

    for (let i = 0; i < input.participants.length; i++) {
      const part = input.participants[i];
      const shareAmount = Number(part.share_amount.toFixed(2));
      const isRegistered = Boolean(part.customer_id);
      const cust = isRegistered && part.customer_id ? custMap.get(part.customer_id) : null;
      const payerCust = part.paid_by_customer_id ? custMap.get(part.paid_by_customer_id) : null;

      const custAdvance = Number(cust?.advance_balance || 0);
      const useAdvance = isRegistered && part.use_advance === true && custAdvance > 0;
      const advanceUsed = useAdvance ? Math.min(custAdvance, shareAmount) : 0;
      const balanceAfterAdv = Math.max(0, shareAmount - advanceUsed);

      const cashPaid = Math.max(0, Number(part.cash_paid || 0));
      const upiPaid = Math.max(0, Number(part.upi_paid || 0));
      const directPaid = Math.min(balanceAfterAdv, cashPaid + upiPaid);
      const paidTotal = Number((advanceUsed + directPaid).toFixed(2));
      totalGroupPaid += paidTotal;

      let paymentMethod = part.payment_method || 'Pay Later';
      if (!part.payment_method) {
        if (paidTotal >= shareAmount - 0.01) {
          if (advanceUsed >= shareAmount - 0.01) paymentMethod = 'Advance Used';
          else if (upiPaid > 0 && cashPaid === 0) paymentMethod = 'UPI';
          else if (cashPaid > 0 && upiPaid === 0) paymentMethod = 'Cash';
          else if (cashPaid > 0 && upiPaid > 0) paymentMethod = 'Split Payment';
          else paymentMethod = 'Cash';
        } else if (paidTotal > 0) {
          paymentMethod = cashPaid > 0 && upiPaid > 0 ? 'Split Payment' : (upiPaid > 0 ? 'UPI' : 'Cash');
        } else {
          paymentMethod = 'Pay Later';
        }
      }

      if (part.paid_by_customer_id && payerCust && paidTotal >= shareAmount - 0.01) {
        paymentMethod = `Paid by ${payerCust.name}`;
      }

      const billNumber = await this.getNextSequence('BILL');
      const participantName = isRegistered && cust ? cust.name : (part.customer_name || `Guest ${i + 1}`);

      const { data: bill, error: billErr } = await supabase
        .from('bills')
        .insert([{
          bill_number: billNumber,
          customer_id: isRegistered ? part.customer_id : null,
          group_bill_id: groupBill.id,
          group_role: (part.customer_id && part.customer_id === primaryPayerId) ? 'PRIMARY_PAYER' : 'MEMBER',
          paid_by_customer_id: part.paid_by_customer_id || null,
          total: shareAmount,
          discount: 0,
          gst_amount: 0,
          rounding_method: 'None',
          rounding_adjustment: 0,
          grand_total: shareAmount,
          cash_paid: cashPaid,
          upi_paid: upiPaid,
          paid_total: paidTotal,
          advance_used: advanceUsed,
          advance_earned: 0,
          payment_method: paymentMethod,
          status: 'COMPLETED',
          notes: `Shared Bill Share (${groupBillNumber}) - ${participantName}`,
          ...(userId ? { user_id: userId } : {})
        }])
        .select('*, customers!fk_bills_customer(name, mobile, email)')
        .maybeSingle();

      if (billErr || !bill) throw new Error(billErr?.message || `Failed to create bill for participant ${participantName}`);

      // Insert descriptive line item for this participant's share
      const shareLineItem = {
        bill_id: bill.id,
        product_id: null,
        product_name: `Group Bill Share (${groupBillNumber}): ${itemsSummaryText.slice(0, 80)}`,
        quantity: 1,
        price: shareAmount,
        total: shareAmount,
        ...(userId ? { user_id: userId } : {})
      };
      await this.insertBillItemsWithFallback([shareLineItem]);

      // Create payment receipt if direct payment was made
      if (directPaid > 0) {
        const paySeq = await this.getNextSequence('PAYMENT');
        const payerId = part.paid_by_customer_id || (isRegistered ? part.customer_id : null);
        if (payerId) {
          await supabase.from('payments').insert([{
            payment_number: paySeq,
            customer_id: payerId,
            bill_id: bill.id,
            amount: directPaid,
            payment_method: (upiPaid > 0 && cashPaid === 0) ? 'UPI' : (cashPaid > 0 && upiPaid === 0 ? 'Cash' : 'Split Payment'),
            status: 'COMPLETED',
            notes: part.paid_by_customer_id && payerCust
              ? `Shared Bill payment by ${payerCust.name} for ${participantName} (${groupBillNumber})`
              : `Shared Bill payment for ${participantName} (${groupBillNumber})`,
            ...(userId ? { user_id: userId } : {})
          }]);
        }
      }

      // Deduct advance balance if used
      if (advanceUsed > 0 && cust) {
        const newAdv = Math.max(0, custAdvance - advanceUsed);
        await supabase.from('customers').update({ advance_balance: newAdv }).eq('id', cust.id);
        cust.advance_balance = newAdv;
      }

      // Award loyalty points to the actual payer if this participant's share is fully paid
      const payerId = part.paid_by_customer_id || (isRegistered ? part.customer_id : null);
      if (paidTotal >= shareAmount - 0.01 && payerId && settings.loyalty.enabled) {
        const pointsEarned = await this.calculateLoyaltyPointsEarned(paidTotal);
        if (pointsEarned > 0) {
          const loySeq = await this.getNextSequence('LOYALTY');
          await supabase.from('loyalty_transactions').insert([{
            transaction_number: loySeq,
            customer_id: payerId,
            bill_id: bill.id,
            points: pointsEarned,
            type: 'EARN',
            notes: part.paid_by_customer_id && payerCust
              ? `Group Bill Loyalty (${groupBillNumber}): Paid by ${payerCust.name} for ${participantName}`
              : `Group Bill Loyalty (${groupBillNumber}): ${participantName}`,
            ...(userId ? { user_id: userId } : {})
          }]);
          const { data: pRec } = await supabase.from('customers').select('loyalty_points').eq('id', payerId).maybeSingle();
          if (pRec) {
            const newLoyalty = Number((Number(pRec.loyalty_points || 0) + pointsEarned).toFixed(2));
            await supabase.from('customers').update({ loyalty_points: newLoyalty }).eq('id', payerId);
          }
          await supabase.from('bills').update({ loyalty_points_earned: pointsEarned }).eq('id', bill.id);
          bill.loyalty_points_earned = pointsEarned;
        }
      }

      createdBills.push(this.formatBillRow({
        ...bill,
        customer_name: participantName,
        items: [shareLineItem]
      }));
    }

    // 6. Update parent group_bills with final totals
    const finalGroupBalanceDue = Math.max(0, groupGrandTotal - totalGroupPaid);
    await supabase.from('group_bills').update({
      paid_amount: totalGroupPaid,
      balance_due: finalGroupBalanceDue
    }).eq('id', groupBill.id);

    await this.logAudit({
      user_name: userName,
      action: 'CREATE_SHARED_BILLING',
      entity: `Group Bill ${groupBillNumber}`,
      new_value: `Participants: ${input.participants.length}, Grand Total: ₹${groupGrandTotal}, Paid: ₹${totalGroupPaid}`
    });

    return {
      ...groupBill,
      paid_amount: totalGroupPaid,
      balance_due: finalGroupBalanceDue,
      bills: createdBills,
      items: masterItemsToInsert
    };
  }

  static async cancelIndividualGroupMemberBill(
    billId: string,
    reason: string,
    userName = 'Super Admin'
  ): Promise<{ success: boolean; bill: Bill; groupBill?: GroupBill }> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    const bill = await this.getBillById(billId);
    if (!bill) throw new Error('Bill not found');
    if (bill.status === 'CANCELLED') throw new Error('This bill is already cancelled.');

    const userId = await this.getUserId();
    const now = new Date().toISOString();

    // 1. Mark this individual bill as CANCELLED
    const { data: updatedBill, error: billErr } = await supabase
      .from('bills')
      .update({
        status: 'CANCELLED',
        cancelled_at: now,
        cancelled_by: userName,
        cancellation_reason: reason
      })
      .eq('id', billId)
      .select('*, customers!fk_bills_customer(name, mobile, email)')
      .maybeSingle();

    if (billErr || !updatedBill) throw new Error(billErr?.message || 'Failed to cancel bill');

    // 2. Refund advance if advance was utilized
    const advanceUsed = Number(bill.advance_used || 0);
    if (bill.customer_id && advanceUsed > 0) {
      const { data: cust } = await supabase
        .from('customers')
        .select('advance_balance')
        .eq('id', bill.customer_id)
        .maybeSingle();

      if (cust) {
        const refundedAdvance = Number((Number(cust.advance_balance || 0) + advanceUsed).toFixed(2));
        await supabase
          .from('customers')
          .update({ advance_balance: refundedAdvance })
          .eq('id', bill.customer_id);
      }
    }

    // 3. Mark all payments linked to this bill as CANCELLED
    await supabase
      .from('payments')
      .update({
        status: 'CANCELLED',
        cancellation_reason: `Individual Bill Cancelled: ${reason}`,
        cancelled_at: now,
        cancelled_by: userName
      })
      .eq('bill_id', billId)
      .eq('status', 'COMPLETED');

    // 4. Reverse loyalty points from whoever earned them (payer or customer)
    const payerOrCustomerId = bill.paid_by_customer_id || bill.customer_id;
    if (payerOrCustomerId && Number(bill.loyalty_points_earned || 0) > 0) {
      const pointsToReverse = Number(bill.loyalty_points_earned);
      const loySeq = await this.getNextSequence('LOYALTY');
      await supabase.from('loyalty_transactions').insert([{
        transaction_number: loySeq,
        customer_id: payerOrCustomerId,
        bill_id: bill.id,
        points: -pointsToReverse,
        type: 'ADJUST',
        notes: `Reversal: Member Bill Cancelled - ${bill.bill_number}`,
        ...(userId ? { user_id: userId } : {})
      }]);

      const { data: cust } = await supabase
        .from('customers')
        .select('loyalty_points')
        .eq('id', payerOrCustomerId)
        .maybeSingle();

      if (cust) {
        const newLoyalty = Math.max(0, Number(cust.loyalty_points || 0) - pointsToReverse);
        await supabase.from('customers').update({ loyalty_points: newLoyalty }).eq('id', payerOrCustomerId);
      }
    }

    // 5. If this bill belongs to a group_bill, update parent group_bill totals atomically
    let updatedGroupBill: GroupBill | undefined;
    if (bill.group_bill_id) {
      const { data: allChildBills } = await supabase
        .from('bills')
        .select('*')
        .eq('group_bill_id', bill.group_bill_id);

      const activeBills = (allChildBills || []).filter(b => b.id !== billId && b.status !== 'CANCELLED');
      const activeGrandTotal = Number(activeBills.reduce((s, b) => s + Number(b.grand_total || 0), 0).toFixed(2));
      const activePaidAmount = Number(activeBills.reduce((s, b) => s + Number(b.paid_total || 0), 0).toFixed(2));
      const activeBalanceDue = Math.max(0, activeGrandTotal - activePaidAmount);
      const groupStatus = activeBills.length === 0 ? 'CANCELLED' : 'PARTIALLY_CANCELLED';

      const { data: grp } = await supabase
        .from('group_bills')
        .update({
          grand_total: activeGrandTotal,
          paid_amount: activePaidAmount,
          balance_due: activeBalanceDue,
          participant_count: activeBills.length,
          status: groupStatus
        })
        .eq('id', bill.group_bill_id)
        .select()
        .maybeSingle();

      if (grp) updatedGroupBill = grp as GroupBill;
    }

    await this.logAudit({
      user_name: userName,
      action: 'CANCEL_MEMBER_BILL',
      entity: `Bill ${bill.bill_number}`,
      new_value: `Reason: ${reason}, Advance Refunded: ₹${advanceUsed}, Group Bill ID: ${bill.group_bill_id || 'None'}`
    });

    return {
      success: true,
      bill: this.formatBillRow(updatedBill),
      groupBill: updatedGroupBill
    };
  }

  static async getGroupBills(): Promise<GroupBill[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('group_bills')
      .select('*, bills(*, customers!fk_bills_customer(name, mobile, email))')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(gb => ({
      ...gb,
      bills: (gb.bills || []).map((b: Record<string, unknown>) => this.formatBillRow(b))
    }));
  }

  static async getGroupBillById(id: string): Promise<GroupBill | null> {
    if (!isSupabaseConfigured) return null;
    const { data: grp, error } = await supabase
      .from('group_bills')
      .select('*, bills(*, customers!fk_bills_customer(name, mobile, email)), group_bill_items(*)')
      .eq('id', id)
      .maybeSingle();

    if (error || !grp) return null;
    return {
      ...grp,
      bills: (grp.bills || []).map((b: Record<string, unknown>) => this.formatBillRow(b)),
      items: grp.group_bill_items || []
    };
  }


  static async getCustomerLedger(customerId: string): Promise<{
    customer: Customer | null;
    entries: CustomerLedgerEntry[];
    totalBilled: number;
    totalPaid: number;
    runningBalance: number;
    pendingPoints: number;
  }> {
    if (!isSupabaseConfigured) {
      return { customer: null, entries: [], totalBilled: 0, totalPaid: 0, runningBalance: 0, pendingPoints: 0 };
    }

    const custQ = supabase
      .from('customers')
      .select('*')
      .eq('id', customerId);
    const { data: primaryCustomer, error: custErr } = await custQ.maybeSingle();
    let customer = primaryCustomer;

    if (!customer) {
      const { data: fallbackCust } = await supabase.from('customers').select('*').eq('id', customerId).maybeSingle();
      customer = fallbackCust;
    }

    if (custErr || !customer) {
      return { customer: null, entries: [], totalBilled: 0, totalPaid: 0, runningBalance: 0, pendingPoints: 0 };
    }

    const [billsRes, paymentsRes] = await Promise.all([
      supabase
        .from('bills')
        .select('*, bill_items(*)')
        .or(`customer_id.eq.${customerId},paid_by_customer_id.eq.${customerId}`)
        .order('created_at', { ascending: true }),
      supabase
        .from('payments')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: true })
    ]);

    const bills = billsRes.data || [];
    const payments = paymentsRes.data || [];

    let pendingPoints = 0;
    for (const b of (bills || [])) {
      const due = Math.max(0, Number(b.grand_total || 0) - Number(b.paid_total || 0));
      if (due > 0.01) {
        const pts = await this.calculateLoyaltyPointsEarned(Number(b.grand_total || 0));
        pendingPoints += pts;
      }
    }

    const activePayments = (payments || []).filter(p => p.status !== 'CANCELLED' && p.status !== 'REVERSED');

    const totalAllTimeBilled = Number((bills || []).reduce((sum, b) => sum + Number(b.grand_total || 0), 0).toFixed(2));
    const totalBillPaid = Number((bills || []).reduce((sum, b) => sum + Number(b.paid_total || 0), 0).toFixed(2));
    const totalPaymentsVouchers = Number(activePayments.reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(2));
    const totalCustomerPaid = Math.max(totalPaymentsVouchers, totalBillPaid);

    const totalBillDues = Number((bills || []).reduce((sum, b) => sum + Math.max(0, Number(b.grand_total || 0) - Number(b.paid_total || 0)), 0).toFixed(2));
    const trueAdvance = totalCustomerPaid > totalAllTimeBilled ? Number((totalCustomerPaid - totalAllTimeBilled).toFixed(2)) : 0.00;
    const totalAllTimePaidBills = Math.min(totalAllTimeBilled, totalCustomerPaid);

    const storedAdvBefore = Number(customer.advance_balance || 0);
    customer.advance_balance = trueAdvance;
    if (Math.abs(storedAdvBefore - trueAdvance) > 0.001) {
      await supabase.from('customers').update({ advance_balance: trueAdvance }).eq('id', customerId);
    }

    const billMap = new Map((bills || []).map(b => [b.id, b]));
    const initialPaymentByBillId = new Map<string, (typeof activePayments)[0]>();
    const mergedPaymentIds = new Set<string>();

    for (const p of activePayments) {
      if (p.bill_id && billMap.has(p.bill_id)) {
        const b = billMap.get(p.bill_id)!;
        const diffSec = (new Date(p.created_at).getTime() - new Date(b.created_at).getTime()) / 1000;
        const hasInitialInNotes = p.notes && p.notes.toLowerCase().includes('initial');
        if ((diffSec >= -5 && diffSec <= 30) || hasInitialInNotes) {
          initialPaymentByBillId.set(b.id, p);
          mergedPaymentIds.add(p.id);
        }
      }
    }

    const rawEvents: {
      date: string;
      type: 'BILL' | 'PAYMENT' | 'ADVANCE_USED' | 'OPENING_BALANCE' | 'LOYALTY_REDEEM';
      reference_no: string;
      bill_id?: string;
      description: string;
      bill_amount: number;
      paid_amount: number;
      advance_used: number;
      direct_paid?: number;
      bill_due?: number;
      is_fully_paid?: boolean;
      loyalty_points: number;
      payment_method?: string;
      items_summary?: string;
      items?: {
        product_name: string;
        quantity: number;
        price: number;
        total: number;
      }[];
    }[] = [];

    // 2. Bill Invoices (Debit & Immediate Settlement on the SAME clean row)
    (bills || []).forEach(b => {
      const grand = Number(b.grand_total || 0);
      const advUsed = Number(b.advance_used || 0);
      let payMethod = b.payment_method || 'Cash';

      const initialPayment = initialPaymentByBillId.get(b.id);
      let paidAmount = 0;
      let payRef = '';

      if (initialPayment) {
        paidAmount = Number(initialPayment.amount || 0);
        payMethod = initialPayment.payment_method || payMethod;
        payRef = initialPayment.payment_number;
      } else {
        paidAmount = Math.max(0, Number(b.paid_total || 0) - advUsed);
      }

      const directPaid = Math.min(grand, paidAmount);
      const totalSettledOnBill = Number((directPaid + advUsed).toFixed(2));
      const billDue = Math.max(0, Number((grand - totalSettledOnBill).toFixed(2)));
      const isFullyPaid = billDue <= 0.009;
      const items = (b.bill_items as BillItem[]) || [];
      const itemsSummary = items.map(i => `${i.product_name} (${i.quantity})`).join(', ');

      let billDesc = itemsSummary || 'Sales Invoice Billed';
      if (b.paid_by_customer_id && b.paid_by_customer_id === customerId && b.customer_id !== customerId) {
        billDesc = `[Paid on Behalf of Member] ${b.notes || billDesc}`;
      } else if (b.paid_by_customer_id && b.paid_by_customer_id !== customerId && b.customer_id === customerId) {
        billDesc = `[Covered by Payer] ${b.notes || billDesc}`;
      } else if (b.group_bill_id) {
        billDesc = `[Group Order Share] ${b.notes || billDesc}`;
      }
      if (initialPayment) {
        if (advUsed > 0) {
          billDesc += ` [Paid: ₹${advUsed.toFixed(2)} Adv + ₹${paidAmount.toFixed(2)} ${payMethod} via ${payRef}]`;
        } else {
          billDesc += ` [Paid at checkout via ${payMethod} (${payRef})]`;
        }
      } else if (advUsed > 0 && directPaid > 0) {
        billDesc += ` [Paid: ₹${advUsed.toFixed(2)} Adv + ₹${directPaid.toFixed(2)} ${payMethod}]`;
      } else if (advUsed > 0) {
        billDesc += ` [Paid: ₹${advUsed.toFixed(2)} Advance]`;
      } else if (directPaid > 0) {
        billDesc += ` [Paid at checkout via ${payMethod}]`;
      } else if (payMethod && payMethod !== 'Pay Later') {
        billDesc += ` [Mode: ${payMethod}]`;
      }

      rawEvents.push({
        date: b.created_at,
        type: 'BILL',
        reference_no: b.bill_number,
        bill_id: b.id,
        description: billDesc,
        bill_amount: grand,
        paid_amount: paidAmount,
        advance_used: advUsed,
        direct_paid: directPaid,
        bill_due: billDue,
        is_fully_paid: isFullyPaid,
        loyalty_points: Number(b.loyalty_points_earned || 0),
        payment_method: payMethod,
        items_summary: itemsSummary,
        items: items.map(it => ({
          product_name: it.product_name,
          quantity: it.quantity,
          price: it.price,
          total: it.total
        }))
      });
    });

    // 3. Standalone / Delayed Payment Vouchers (Credit events)
    activePayments.forEach(p => {
      if (mergedPaymentIds.has(p.id)) return; // Consolidated into the bill row

      const amt = Number(p.amount || 0);

      rawEvents.push({
        date: p.created_at,
        type: 'PAYMENT',
        reference_no: p.payment_number || 'PAY',
        bill_id: p.bill_id || undefined,
        description: p.notes || `Payment received via ${p.payment_method || 'Cash'}`,
        bill_amount: 0,
        paid_amount: amt,
        advance_used: 0,
        loyalty_points: 0,
        payment_method: p.payment_method || 'Cash'
      });
    });

    // Sort chronologically; when timestamps match, OPENING_BALANCE precedes BILL precedes PAYMENT
    rawEvents.sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (diff !== 0) return diff;
      const order: Record<string, number> = { OPENING_BALANCE: 1, BILL: 2, ADVANCE_USED: 3, PAYMENT: 4, LOYALTY_REDEEM: 5 };
      return (order[a.type] || 99) - (order[b.type] || 99);
    });

    let ledgerRunningBalance = 0;
    const entries: CustomerLedgerEntry[] = rawEvents.map((evt, idx) => {
      ledgerRunningBalance += (evt.bill_amount - evt.paid_amount);

      return {
        id: `entry-${idx}`,
        date: evt.date,
        type: evt.type,
        reference_no: evt.reference_no,
        bill_id: evt.bill_id,
        description: evt.description,
        bill_amount: evt.bill_amount,
        paid_amount: evt.paid_amount,
        advance_used: evt.advance_used,
        direct_paid: evt.direct_paid,
        bill_due: evt.bill_due,
        is_fully_paid: evt.is_fully_paid,
        loyalty_points: evt.loyalty_points,
        running_balance: Number(ledgerRunningBalance.toFixed(2)),
        payment_method: evt.payment_method,
        items: evt.items
      };
    });

    return {
      customer,
      entries,
      totalBilled: totalAllTimeBilled,
      totalPaid: totalAllTimePaidBills,
      runningBalance: totalBillDues,
      pendingPoints
    };
  }


  static async processBillFullPaymentLoyalty(billId: string): Promise<number> {
    if (!isSupabaseConfigured || !billId) return 0;
    const userId = await this.getUserId();

    const { data: bill, error } = await supabase
      .from('bills')
      .select('*')
      .eq('id', billId)
      .maybeSingle();

    if (error || !bill || !bill.customer_id) return 0;

    const settings = await this.getSettings();
    if (!settings.loyalty.enabled) return 0;

    // Prevent duplicate loyalty awards for the same bill
    const { data: existingEarnTx } = await supabase
      .from('loyalty_transactions')
      .select('id')
      .eq('bill_id', billId)
      .eq('type', 'EARN');

    if (existingEarnTx && existingEarnTx.length > 0) {
      return 0; // Already awarded!
    }

    // Determine total payments for this specific bill
    const { data: billPayments } = await supabase
      .from('payments')
      .select('amount, status')
      .eq('bill_id', billId);

    const directPaymentsSum = (billPayments || [])
      .filter(p => p.status !== 'CANCELLED' && p.status !== 'REVERSED')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalPaidForBill = Number(bill.advance_used || 0) + Math.max(Number(bill.paid_total || 0) - Number(bill.advance_used || 0), directPaymentsSum);

    const isFullyPaid = totalPaidForBill >= Number(bill.grand_total || 0) - 0.01;

    if (!isFullyPaid) {
      return 0; // Bill is not fully paid yet
    }

    // Calculate points using active earning rules on grand_total
    const pointsEarned = await this.calculateLoyaltyPointsEarned(Number(bill.grand_total || 0));
    if (pointsEarned <= 0) return 0;

    // Insert EARN transaction record with reason: Bill Fully Paid
    const loySeq = await this.getNextSequence('LOYALTY');
    await supabase.from('loyalty_transactions').insert([{
      transaction_number: loySeq,
      customer_id: bill.customer_id,
      bill_id: billId,
      points: pointsEarned,
      type: 'EARN',
      created_at: bill.created_at || new Date().toISOString(),
      notes: `Award Reason: Bill Fully Paid - ${bill.bill_number}`,
      ...(userId ? { user_id: userId } : {})
    }]);

    // Update bill record
    await supabase.from('bills').update({
      loyalty_points_earned: pointsEarned
    }).eq('id', billId);

    // Update customer loyalty points balance
    const { data: cust } = await supabase
      .from('customers')
      .select('loyalty_points')
      .eq('id', bill.customer_id)
      .maybeSingle();

    if (cust) {
      const currentPoints = Number(cust.loyalty_points || 0);
      await supabase.from('customers').update({
        loyalty_points: currentPoints + pointsEarned
      }).eq('id', bill.customer_id);
    }

    return pointsEarned;
  }


  static async reverseLoyaltyPointsForBill(billId: string, userName = 'Admin'): Promise<number> {
    if (!isSupabaseConfigured || !billId) return 0;
    const userId = await this.getUserId();

    const { data: bill } = await supabase
      .from('bills')
      .select('*')
      .eq('id', billId)
      .maybeSingle();

    if (!bill || !bill.customer_id) return 0;

    const { data: earnTxs } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('bill_id', billId)
      .eq('type', 'EARN');

    if (!earnTxs || earnTxs.length === 0) return 0;

    let totalPointsToReverse = 0;
    for (const tx of earnTxs) {
      totalPointsToReverse += Number(tx.points || 0);
    }

    if (totalPointsToReverse > 0) {
      const loySeq = await this.getNextSequence('LOYALTY');
      await supabase.from('loyalty_transactions').insert([{
        transaction_number: loySeq,
        customer_id: bill.customer_id,
        bill_id: billId,
        points: -totalPointsToReverse,
        type: 'ADJUST',
        notes: `Loyalty Reversal: Bill Cancelled/Refunded (${bill.bill_number})`,
        ...(userId ? { user_id: userId } : {})
      }]);

      const { data: cust } = await supabase
        .from('customers')
        .select('loyalty_points')
        .eq('id', bill.customer_id)
        .maybeSingle();

      if (cust) {
        const currentPoints = Number(cust.loyalty_points || 0);
        await supabase.from('customers').update({
          loyalty_points: Math.max(0, currentPoints - totalPointsToReverse)
        }).eq('id', bill.customer_id);
      }

      await this.logAudit({
        user_name: userName,
        action: 'REVERSE_LOYALTY_POINTS',
        entity: `Bill ${bill.bill_number}`,
        new_value: `Reversed ${totalPointsToReverse} loyalty points due to cancellation/refund`
      });
    }

    return totalPointsToReverse;
  }


  static async recalculateAllCustomerLoyaltyPoints(userName = 'Super Admin'): Promise<{
    customersProcessed: number;
    customersUpdated: number;
    billsUpdated: number;
    totalActivePoints: number;
  }> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const custQ = supabase.from('customers').select('*');
    const billsQ = supabase.from('bills').select('*');
    const txQ = supabase.from('loyalty_transactions').select('*');

    const { data: customers, error: custErr } = await custQ;
    if (custErr) throw new Error(custErr.message);

    const { data: bills, error: billsErr } = await billsQ;
    if (billsErr) throw new Error(billsErr.message);

    const { data: transactions, error: txErr } = await txQ;
    if (txErr) throw new Error(txErr.message);

    let customersUpdated = 0;
    let billsUpdated = 0;
    let totalActivePoints = 0;

    for (const cust of (customers || [])) {
      const custBills = (bills || []).filter(b => b.customer_id === cust.id);
      const custTxs = (transactions || []).filter(t => t.customer_id === cust.id);

      let customerEarnedPoints = 0;

      for (const bill of custBills) {
        const grandTotal = Number(bill.grand_total || 0);
        const paidTotal = Number(bill.paid_total || 0);
        const isPaid = paidTotal >= grandTotal - 0.01 && grandTotal > 0;

        if (isPaid) {
          const expectedPoints = await this.calculateLoyaltyPointsEarned(grandTotal);
          customerEarnedPoints += expectedPoints;

          if (Number(bill.loyalty_points_earned || 0) !== expectedPoints) {
            await supabase.from('bills').update({ loyalty_points_earned: expectedPoints }).eq('id', bill.id);
            billsUpdated++;
          }
        } else {
          if (Number(bill.loyalty_points_earned || 0) !== 0) {
            await supabase.from('bills').update({ loyalty_points_earned: 0 }).eq('id', bill.id);
            billsUpdated++;
          }
        }
      }

      let totalRedeemed = 0;
      let totalAdjusted = 0;
      for (const tx of custTxs) {
        if (tx.type === 'REDEEM') {
          totalRedeemed += Math.abs(Number(tx.points || 0));
        } else if (tx.type === 'ADJUST') {
          totalAdjusted += Number(tx.points || 0);
        }
      }

      const calculatedLoyalty = Math.max(0, customerEarnedPoints - totalRedeemed + totalAdjusted);
      totalActivePoints += calculatedLoyalty;

      if (Number(cust.loyalty_points || 0) !== calculatedLoyalty) {
        await supabase.from('customers').update({ loyalty_points: calculatedLoyalty }).eq('id', cust.id);
        customersUpdated++;
      }
    }

    await this.logAudit({
      user_name: userName,
      action: 'RECALCULATE_LOYALTY_POINTS',
      entity: 'All Customers',
      new_value: `Processed ${(customers || []).length} customers, updated ${customersUpdated} customer balances, ${billsUpdated} bills. Total active points: ${totalActivePoints}`
    });

    return {
      customersProcessed: (customers || []).length,
      customersUpdated,
      billsUpdated,
      totalActivePoints
    };
  }


  static async getBillFinancialSummary(bill: Bill): Promise<BillFinancialSummary> {
    const defaultSummary: BillFinancialSummary = {
      previous_outstanding: 0,
      previous_advance: 0,
      current_bill_amount: Number(bill.grand_total || 0),
      total_amount_due: Number(bill.grand_total || 0),
      cash_paid: Number(bill.cash_paid || 0),
      upi_paid: Number(bill.upi_paid || 0),
      advance_used: Number(bill.advance_used || 0),
      total_paid: Number(bill.paid_total || 0),
      remaining_balance: Math.max(0, Number(bill.grand_total || 0) - Number(bill.paid_total || 0)),
      remaining_advance_balance: Number(bill.advance_earned || 0),
      payment_status: (Number(bill.paid_total || 0) >= Number(bill.grand_total || 0) - 0.01)
        ? 'Fully Paid'
        : (Number(bill.paid_total || 0) > 0.01 ? 'Partially Paid' : 'Payment Pending')
    };

    if (!bill.customer_id || !isSupabaseConfigured) {
      return defaultSummary;
    }

    try {
      const custQ = supabase.from('customers').select('*').eq('id', bill.customer_id);
      const billsQ = supabase.from('bills').select('*').eq('customer_id', bill.customer_id).order('created_at', { ascending: true });
      const payQ = supabase.from('payments').select('*').eq('customer_id', bill.customer_id).order('created_at', { ascending: true });
      const loyQ = supabase.from('loyalty_transactions').select('*').eq('customer_id', bill.customer_id).order('created_at', { ascending: true });

      const [settings, { data: customer }, { data: allCustBills }, { data: allCustPayments }, { data: allCustLoyalty }] = await Promise.all([
        this.getSettings(),
        custQ.maybeSingle(),
        billsQ,
        payQ,
        loyQ
      ]);

      if (!customer) return defaultSummary;

      // Index-based partitioning: find current bill's position in customer's bill history
      const billList = allCustBills || [];
      const billIndex = billList.findIndex(b => b.id === bill.id);
      const priorBills = billIndex > 0 ? billList.slice(0, billIndex) : (billIndex === -1 ? billList.filter(b => b.created_at < (bill.created_at || '')) : []);

      const priorBillIds = new Set(priorBills.map(b => b.id));
      const billTimestamp = new Date(bill.created_at || Date.now()).getTime();

      const priorPayments = (allCustPayments || [])
        .filter(p => p.status !== 'CANCELLED' && p.status !== 'REVERSED')
        .filter(p => {
          if (p.bill_id === bill.id) return false;
          if (p.bill_id && priorBillIds.has(p.bill_id)) return true;
          const pTime = new Date(p.created_at).getTime();
          return pTime <= billTimestamp;
        });

      const priorLoyalty = (allCustLoyalty || []).filter(lt => {
        if (lt.bill_id === bill.id) return false;
        if (lt.bill_id && priorBillIds.has(lt.bill_id)) return true;
        const ltTime = new Date(lt.created_at).getTime();
        return ltTime <= billTimestamp;
      });

      const priorTotalBilled = Number(priorBills.reduce((s, b) => s + Number(b.grand_total || 0), 0).toFixed(2));
      const priorBillPaid = Number(priorBills.reduce((s, b) => s + Number(b.paid_total || 0), 0).toFixed(2));
      const priorVouchers = Number((priorPayments || []).reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(2));
      const priorTotalPaid = Math.max(priorVouchers, priorBillPaid);

      const previous_outstanding = Math.max(0, Number(priorBills.reduce((s, b) => s + Math.max(0, Number(b.grand_total || 0) - Number(b.paid_total || 0)), 0).toFixed(2)));
      const previous_advance = priorTotalPaid > priorTotalBilled ? Number((priorTotalPaid - priorTotalBilled).toFixed(2)) : 0.00;

      const advance_used = Number(bill.advance_used || 0);
      const advance_earned = Number(bill.advance_earned || 0);

      const current_bill_amount = Number(bill.grand_total || 0);
      const total_amount_due = previous_outstanding + current_bill_amount;

      const cash_paid = Number(bill.cash_paid || 0);
      const upi_paid = Number(bill.upi_paid || 0);
      const total_paid = Number(bill.paid_total || (cash_paid + upi_paid + advance_used));

      const remaining_balance = Math.max(0, Number((total_amount_due - total_paid).toFixed(2)));
      const remaining_advance_balance = Math.max(0, Number((previous_advance - advance_used + advance_earned).toFixed(2)));

      const bill_remaining = Math.max(0, current_bill_amount - total_paid);
      const isFullyPaid = bill_remaining <= 0.01;
      const isPartiallyPaid = !isFullyPaid && total_paid > 0.01;
      const payment_status = isFullyPaid
        ? 'Fully Paid'
        : (isPartiallyPaid ? 'Partially Paid' : 'Payment Pending');

      let loyaltySummary: BillFinancialSummary['loyalty'] = undefined;
      if (settings?.loyalty?.enabled) {
        const earnTxQuery = supabase
          .from('loyalty_transactions')
          .select('*')
          .eq('bill_id', bill.id)
          .eq('type', 'EARN');

        const { data: earnTx } = await earnTxQuery.maybeSingle();

        const is_fully_paid = bill_remaining <= 0.01;
        const points_awarded = !!earnTx;

        let previous_points = 0;
        (priorLoyalty || []).forEach(lt => {
          if (lt.bill_id !== bill.id) {
            if (lt.type === 'REDEEM') {
              previous_points -= Math.abs(Number(lt.points || 0));
            } else {
              previous_points += Number(lt.points || 0);
            }
          }
        });
        previous_points = Math.max(0, previous_points);

        const calculatedEarned = await this.calculateLoyaltyPointsEarned(current_bill_amount);
        const points_earned = earnTx ? Number(earnTx.points) : calculatedEarned;
        const points_redeemed = Number(bill.loyalty_points_redeemed || 0);
        const points_added = (is_fully_paid || points_awarded) ? points_earned : 0;
        const current_points_balance = Math.max(0, previous_points + points_added - points_redeemed);

        let total_pending_points = 0;
        const processedBillIds = new Set<string>();
        for (const b of (allCustBills || [])) {
          processedBillIds.add(b.id);
          const bDue = Math.max(0, Number(b.grand_total || 0) - (b.id === bill.id ? total_paid : Number(b.paid_total || 0)));
          if (bDue > 0.01) {
            const pts = (b.id === bill.id) ? points_earned : await this.calculateLoyaltyPointsEarned(Number(b.grand_total || 0));
            total_pending_points += pts;
          }
        }
        if (!processedBillIds.has(bill.id) && !is_fully_paid) {
          total_pending_points += points_earned;
        }

        const message = is_fully_paid
          ? `🎁 Loyalty Earned: +${points_earned} Points`
          : `⏳ Loyalty Points will be credited after this bill is fully paid.`;

        loyaltySummary = {
          enabled: true,
          is_fully_paid,
          points_awarded,
          points_earned,
          points_redeemed,
          previous_points,
          current_points_balance,
          total_pending_points,
          message
        };
      }

      return {
        previous_outstanding,
        previous_advance,
        current_bill_amount,
        total_amount_due,
        cash_paid,
        upi_paid,
        advance_used,
        total_paid,
        remaining_balance,
        remaining_advance_balance,
        payment_status,
        loyalty: loyaltySummary
      };
    } catch (err) {
      console.error('Error computing bill financial summary:', err);
      return defaultSummary;
    }
  }


  static async recordCustomerPayment(payment: {
    customer_id: string;
    amount: number;
    payment_method: string;
    bill_id?: string;
    notes?: string;
  }, userName = 'Admin'): Promise<Payment | null> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const userId = await this.getUserId();

    // Verify customer exists
    const { data: custRecord, error: custErr } = await supabase
      .from('customers')
      .select('*')
      .eq('id', payment.customer_id)
      .maybeSingle();

    if (custErr || !custRecord) {
      return null;
    }

    // Verify bill if specified
    if (payment.bill_id) {
      const { data: billRecord, error: billErr } = await supabase
        .from('bills')
        .select('*')
        .eq('id', payment.bill_id)
        .maybeSingle();

      if (billErr || !billRecord) {
        return null;
      }
    }

    const payment_number = await this.getNextSequence('PAYMENT');

    const paymentPayload = {
      payment_number,
      customer_id: payment.customer_id,
      bill_id: payment.bill_id || null,
      amount: payment.amount,
      payment_method: payment.payment_method || 'Cash',
      status: 'COMPLETED',
      notes: payment.notes || null,
      ...(userId ? { user_id: userId } : {})
    };

    const { data, error } = await supabase
      .from('payments')
      .insert([paymentPayload])
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Failed to record payment');

    let unallocatedAmount = Number(payment.amount || 0);
    let totalPointsEarned = 0;

    // 1. Direct Bill Allocation
    if (payment.bill_id) {
      const { data: bill } = await supabase
        .from('bills')
        .select('*')
        .eq('id', payment.bill_id)
        .maybeSingle();

      if (bill) {
        const grandTotal = Number(bill.grand_total || 0);
        const currentPaid = Number(bill.paid_total || 0);
        const remainingDue = Math.max(0, grandTotal - currentPaid);
        const allocate = Math.min(remainingDue, unallocatedAmount);

        const newPaidTotal = Number((currentPaid + allocate).toFixed(2));
        const isNowFullyPaid = newPaidTotal >= grandTotal - 0.01;

        const currentCash = Number(bill.cash_paid || 0);
        const currentUpi = Number(bill.upi_paid || 0);
        let newCash = currentCash;
        let newUpi = currentUpi;
        if (payment.payment_method === 'UPI') {
          newUpi += allocate;
        } else if (payment.payment_method === 'Cash') {
          newCash += allocate;
        }

        let newMethod = bill.payment_method;
        if (newUpi > 0 && newCash === 0) newMethod = 'UPI';
        else if (newCash > 0 && newUpi === 0) newMethod = 'Cash';
        else if (newCash > 0 && newUpi > 0) newMethod = 'Split Payment';

        const updateData: { paid_total: number; cash_paid: number; upi_paid: number; payment_method: string; loyalty_points_earned?: number } = {
          paid_total: newPaidTotal,
          cash_paid: newCash,
          upi_paid: newUpi,
          payment_method: newMethod
        };

        if (isNowFullyPaid && Number(bill.loyalty_points_earned || 0) === 0 && grandTotal > 0) {
          const pointsEarned = await this.calculateLoyaltyPointsEarned(grandTotal);
          if (pointsEarned > 0) {
            const loySeq = await this.getNextSequence('LOYALTY');
            await supabase.from('loyalty_transactions').insert([{
              transaction_number: loySeq,
              customer_id: payment.customer_id,
              bill_id: payment.bill_id,
              points: pointsEarned,
              type: 'EARN',
              notes: `Award Reason: Bill Fully Paid - ${bill.bill_number}`,
              ...(userId ? { user_id: userId } : {})
            }]);
            updateData.loyalty_points_earned = pointsEarned;
            totalPointsEarned += pointsEarned;
          }
        }

        await supabase
          .from('bills')
          .update(updateData)
          .eq('id', payment.bill_id);

        if (bill.group_bill_id) {
          const { data: grpBills } = await supabase.from('bills').select('grand_total, paid_total, status').eq('group_bill_id', bill.group_bill_id);
          const activeGrpBills = (grpBills || []).filter(gb => gb.status !== 'CANCELLED');
          const grpGrand = activeGrpBills.reduce((s, gb) => s + Number(gb.grand_total || 0), 0);
          const grpPaid = activeGrpBills.reduce((s, gb) => s + Number(gb.paid_total || 0), 0);
          const grpDue = Math.max(0, grpGrand - grpPaid);
          await supabase.from('group_bills').update({
            paid_amount: Number(grpPaid.toFixed(2)),
            balance_due: Number(grpDue.toFixed(2))
          }).eq('id', bill.group_bill_id);
        }

        unallocatedAmount = Math.max(0, unallocatedAmount - allocate);
      }
    }
    // 2. FIFO Auto-Allocation across outstanding customer bills (Self-First)
    if (payment.customer_id && unallocatedAmount > 0) {
      const { data: bills } = await supabase
        .from('bills')
        .select('*')
        .or(`customer_id.eq.${payment.customer_id},paid_by_customer_id.eq.${payment.customer_id}`)
        .order('created_at', { ascending: true });

      const unpaidBills = (bills || [])
        .filter(b => (!payment.bill_id || b.id !== payment.bill_id) && Number(b.paid_total || 0) < Number(b.grand_total || 0))
        .sort((a, b) => {
          // Self-first FIFO: customer's own bills come before bills covered on behalf of others
          const aIsSelf = a.customer_id === payment.customer_id ? 0 : 1;
          const bIsSelf = b.customer_id === payment.customer_id ? 0 : 1;
          if (aIsSelf !== bIsSelf) return aIsSelf - bIsSelf;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

      for (const b of unpaidBills) {
        if (unallocatedAmount <= 0) break;

        const grandTotal = Number(b.grand_total || 0);
        const currentPaid = Number(b.paid_total || 0);
        const due = grandTotal - currentPaid;
        const allocate = Math.min(due, unallocatedAmount);

        const newPaidTotal = Number((currentPaid + allocate).toFixed(2));
        const isNowFullyPaid = newPaidTotal >= grandTotal - 0.01;

        const currentCash = Number(b.cash_paid || 0);
        const currentUpi = Number(b.upi_paid || 0);
        let newCash = currentCash;
        let newUpi = currentUpi;
        if (payment.payment_method === 'UPI') {
          newUpi += allocate;
        } else if (payment.payment_method === 'Cash') {
          newCash += allocate;
        }

        let newMethod = b.payment_method;
        if (newUpi > 0 && newCash === 0) newMethod = 'UPI';
        else if (newCash > 0 && newUpi === 0) newMethod = 'Cash';
        else if (newCash > 0 && newUpi > 0) newMethod = 'Split Payment';

        const updateData: { paid_total: number; cash_paid: number; upi_paid: number; payment_method: string; loyalty_points_earned?: number } = {
          paid_total: newPaidTotal,
          cash_paid: newCash,
          upi_paid: newUpi,
          payment_method: newMethod
        };

        if (isNowFullyPaid && Number(b.loyalty_points_earned || 0) === 0 && grandTotal > 0) {
          const pointsEarned = await this.calculateLoyaltyPointsEarned(grandTotal);
          if (pointsEarned > 0) {
            const loySeq = await this.getNextSequence('LOYALTY');
            await supabase.from('loyalty_transactions').insert([{
              transaction_number: loySeq,
              customer_id: payment.customer_id,
              bill_id: b.id,
              points: pointsEarned,
              type: 'EARN',
              notes: `Award Reason: Bill Fully Paid - ${b.bill_number}`,
              ...(userId ? { user_id: userId } : {})
            }]);
            updateData.loyalty_points_earned = pointsEarned;
            totalPointsEarned += pointsEarned;
          }
        }

        await supabase
          .from('bills')
          .update(updateData)
          .eq('id', b.id);

        if (b.group_bill_id) {
          const { data: grpBills } = await supabase.from('bills').select('grand_total, paid_total, status').eq('group_bill_id', b.group_bill_id);
          const activeGrpBills = (grpBills || []).filter(gb => gb.status !== 'CANCELLED');
          const grpGrand = activeGrpBills.reduce((s, gb) => s + Number(gb.grand_total || 0), 0);
          const grpPaid = activeGrpBills.reduce((s, gb) => s + Number(gb.paid_total || 0), 0);
          const grpDue = Math.max(0, grpGrand - grpPaid);
          await supabase.from('group_bills').update({
            paid_amount: Number(grpPaid.toFixed(2)),
            balance_due: Number(grpDue.toFixed(2))
          }).eq('id', b.group_bill_id);
        }

        unallocatedAmount -= allocate;
      }
    }

    // 3. Excess payment turns into Advance Balance & settled bills credit Loyalty Points
    if (payment.customer_id && (unallocatedAmount > 0 || totalPointsEarned > 0)) {
      const { data: cust } = await supabase
        .from('customers')
        .select('advance_balance, loyalty_points')
        .eq('id', payment.customer_id)
        .maybeSingle();

      const currentAdv = Number(cust?.advance_balance || 0);
      const currentLoy = Number(cust?.loyalty_points || 0);
      const newAdv = Number((currentAdv + unallocatedAmount).toFixed(2));
      const newLoy = Math.max(0, currentLoy + totalPointsEarned);

      await supabase
        .from('customers')
        .update({ advance_balance: newAdv, loyalty_points: newLoy })
        .eq('id', payment.customer_id);
    }

    await this.logAudit({
      user_name: userName,
      action: 'RECORD_PAYMENT',
      entity: `Payment ${payment_number}`,
      new_value: `Amount: ₹${payment.amount}, Customer ID: ${payment.customer_id}, Method: ${payment.payment_method}`
    });

    return data;
  }


  public static formatPaymentRow(row: Record<string, unknown> | null | undefined): Payment {
    if (!row) return row as unknown as Payment;
    const custRaw = row.customers;
    const cust = Array.isArray(custRaw) ? custRaw[0] : (custRaw as Record<string, unknown> | undefined);
    const billRaw = row.bills;
    const bill = Array.isArray(billRaw) ? billRaw[0] : (billRaw as Record<string, unknown> | undefined);
    return {
      ...(row as unknown as Payment),
      payment_number: (row.payment_number as string | undefined) || 'PAY-N/A',
      customer_name: (row.customer_name as string | undefined) || (cust?.name as string | undefined) || ((row.customer_id as string | undefined) ? 'Customer' : 'Walk-in Customer'),
      customer_mobile: (row.customer_mobile as string | null | undefined) ?? (cust?.mobile as string | null | undefined) ?? null,
      bill_number: (row.bill_number as string | null | undefined) ?? (bill?.bill_number as string | null | undefined) ?? null,
      amount: Number(row.amount || 0)
    };
  }


  static async settleBillDue(payment: {
    bill_id: string;
    customer_id?: string | null;
    amount: number;
    payment_method: 'Cash' | 'UPI';
    notes?: string;
  }, userName = 'Admin'): Promise<void> {
    if (payment.customer_id) {
      await this.recordCustomerPayment({
        customer_id: payment.customer_id,
        bill_id: payment.bill_id,
        amount: payment.amount,
        payment_method: payment.payment_method,
        notes: payment.notes
      }, userName);
    } else {
      const userId = await this.getUserId();

      if (isSupabaseConfigured) {
        const { data: bill } = await supabase
          .from('bills')
          .select('*')
          .eq('id', payment.bill_id)
          .maybeSingle();

        if (!bill) return;

        const payment_number = await this.getNextSequence('PAYMENT');
        const paymentPayload = {
          payment_number,
          customer_id: null,
          bill_id: payment.bill_id,
          amount: payment.amount,
          payment_method: payment.payment_method,
          status: 'COMPLETED',
          notes: payment.notes || null,
          ...(userId ? { user_id: userId } : {})
        };

        await supabase.from('payments').insert([paymentPayload]);

        const currentPaid = Number(bill.paid_total || 0);
        const newPaidTotal = Number((currentPaid + payment.amount).toFixed(2));
        const currentCash = Number(bill.cash_paid || 0);
        const currentUpi = Number(bill.upi_paid || 0);
        const newCash = payment.payment_method === 'Cash' ? currentCash + payment.amount : currentCash;
        const newUpi = payment.payment_method === 'UPI' ? currentUpi + payment.amount : currentUpi;

        let newMethod = bill.payment_method;
        if (newUpi > 0 && newCash === 0) newMethod = 'UPI';
        else if (newCash > 0 && newUpi === 0) newMethod = 'Cash';
        else if (newCash > 0 && newUpi > 0) newMethod = 'Split Payment';

        await supabase.from('bills').update({
          paid_total: newPaidTotal,
          cash_paid: newCash,
          upi_paid: newUpi,
          payment_method: newMethod
        }).eq('id', payment.bill_id);
      }
    }
  }

  static async getPayments(): Promise<Payment[]> {
    if (!isSupabaseConfigured) return [];

    const query = supabase
      .from('payments')
      .select('*, customers(name, mobile), bills(bill_number)');

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching payments:', error.message || error.code || JSON.stringify(error));
      return [];
    }

    return (data || []).map(p => this.formatPaymentRow(p));
  }


  static async reverseBillPayment(
    billId: string,
    reason: string,
    adminPin: string,
    userName = 'Super Admin',
    overridePast48Hours = false,
    refundAdvanceToWallet = false
  ): Promise<{ success: boolean; reversedAmount: number }> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const settings = await this.getSettings();

    if (settings.security.super_admin_pin && settings.security.super_admin_pin !== adminPin) {
      throw new Error('Invalid Super Admin Security PIN. Reversal rejected.');
    }

    const { data: bill, error: billErr } = await supabase
      .from('bills')
      .select('*')
      .eq('id', billId)
      .maybeSingle();

    if (billErr || !bill) {
      return { success: false, reversedAmount: 0 };
    }

    const grandTotal = Number(bill.grand_total || 0);
    const directCashPaid = Number(bill.cash_paid || 0);
    const directUpiPaid = Number(bill.upi_paid || 0);
    const directPaidToReverse = Number((directCashPaid + directUpiPaid).toFixed(2));
    const advanceUsedOnBill = Number(bill.advance_used || 0);
    const advanceEarnedOnBill = Number(bill.advance_earned || 0);
    const hasDirectPayment = directPaidToReverse > 0;

    // Check payment timestamps for reversal limit (default 72 hours)
    const windowHours = Number(settings.security?.payment_reversal_window_hours) || 72;

    const { data: attachedPayments } = await supabase
      .from('payments')
      .select('created_at')
      .eq('bill_id', billId)
      .neq('status', 'CANCELLED')
      .neq('status', 'REVERSED');

    const latestPaymentTime = (attachedPayments && attachedPayments.length > 0)
      ? Math.max(...attachedPayments.map(p => new Date(p.created_at).getTime()))
      : new Date(bill.created_at).getTime();

    const elapsedHours = (Date.now() - latestPaymentTime) / (1000 * 60 * 60);
    const isPastLimit = elapsedHours > windowHours;

    if (isPastLimit && !overridePast48Hours) {
      throw new Error(`Payment was recorded more than ${windowHours} hours ago. Super Admin ${windowHours}-Hour Override confirmation is required.`);
    }

    // 1. Soft-delete / reverse all payments attached to this bill
    await supabase
      .from('payments')
      .update({
        status: 'REVERSED',
        cancellation_reason: isPastLimit ? `[${windowHours}H Override] ${reason}` : reason,
        cancelled_at: new Date().toISOString(),
        cancelled_by: userName
      })
      .eq('bill_id', billId);

    // 2. Adjust customer advance wallet based on reversal context & user selection
    if (bill.customer_id) {
      const { data: cust } = await supabase
        .from('customers')
        .select('advance_balance')
        .eq('id', bill.customer_id)
        .maybeSingle();

      if (cust) {
        let currentAdvance = Number(cust.advance_balance || 0);
        if (refundAdvanceToWallet && advanceUsedOnBill > 0) {
          // Explicit user choice: refund advance back to customer wallet
          currentAdvance += advanceUsedOnBill;
          await supabase
            .from('customers')
            .update({ advance_balance: currentAdvance })
            .eq('id', bill.customer_id);
        } else if (hasDirectPayment) {
          // If direct payment (cash/UPI) overpaid and earned advance, reverse that earned advance credit
          if (advanceEarnedOnBill > 0) {
            currentAdvance = Math.max(0, currentAdvance - advanceEarnedOnBill);
            await supabase
              .from('customers')
              .update({ advance_balance: currentAdvance })
              .eq('id', bill.customer_id);
          }
          // Note: advanceUsedOnBill remains allocated to this bill, so advance wallet is NOT altered
        } else if (advanceUsedOnBill > 0) {
          // If ONLY advance was used (no direct payment to reverse), refund the advance used back to customer's wallet
          currentAdvance += advanceUsedOnBill;
          await supabase
            .from('customers')
            .update({ advance_balance: currentAdvance })
            .eq('id', bill.customer_id);
        }
      }
    }

    // 3. Reset bill payment fields:
    const shouldRetainAdvance = !refundAdvanceToWallet && advanceUsedOnBill > 0 && hasDirectPayment;
    const remainingPaidTotal = shouldRetainAdvance ? advanceUsedOnBill : 0;
    const remainingAdvanceUsed = shouldRetainAdvance ? advanceUsedOnBill : 0;
    const resolvedMethod = remainingPaidTotal >= grandTotal - 0.01 ? 'Advance Used' : 'Pay Later';

    const { error: updateErr } = await supabase
      .from('bills')
      .update({
        paid_total: remainingPaidTotal,
        cash_paid: 0,
        upi_paid: 0,
        advance_used: remainingAdvanceUsed,
        advance_earned: 0,
        payment_method: resolvedMethod,
        edited_at: new Date().toISOString(),
        edited_by: userName,
        edit_reason: isPastLimit ? `Payment Reversal (${windowHours}H Override): ${reason}` : `Payment Reversal: ${reason}`
      })
      .eq('id', billId);

    if (updateErr) throw new Error(updateErr.message);

    // 4. Reverse loyalty points if any were awarded and bill is no longer fully paid
    if (remainingPaidTotal < grandTotal - 0.01) {
      await this.reverseLoyaltyPointsForBill(billId, userName);
    }

    const reversedAmount = hasDirectPayment ? directPaidToReverse : (advanceUsedOnBill > 0 ? advanceUsedOnBill : Number(bill.paid_total || 0));

    await this.logAudit({
      user_name: userName,
      action: isPastLimit ? `REVERSE_BILL_PAYMENT_OVERRIDE_${windowHours}H` : 'REVERSE_BILL_PAYMENT',
      entity: `Bill ${bill.bill_number}`,
      previous_value: `Paid Total: ₹${Number(bill.paid_total || 0).toFixed(2)} (Cash: ₹${directCashPaid}, UPI: ₹${directUpiPaid}, Adv: ₹${advanceUsedOnBill})`,
      new_value: hasDirectPayment
        ? `Direct payments of ₹${directPaidToReverse} reversed. Bill updated to ${resolvedMethod} with ₹${remainingPaidTotal} advance allocated.${isPastLimit ? ` [SUPER ADMIN ${windowHours}H OVERRIDE]` : ''} Reason: ${reason}`
        : `Bill payments cleared to ₹0 and marked REVERSED.${isPastLimit ? ` [SUPER ADMIN ${windowHours}H OVERRIDE]` : ''} Reason: ${reason}`
    });

    return { success: true, reversedAmount };
  }


  /**
   * Allocate a customer's available advance balance to their unpaid bills, oldest first (FIFO).
   * Increases each bill's advance_used / paid_total and decrements the customer's advance wallet.
   */
  static async applyCustomerAdvanceToBills(
    customerId: string,
    userName = 'Admin'
  ): Promise<{ totalApplied: number; billsUpdated: string[]; remainingAdvance: number }> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const userId = await this.getUserId();

    const custQ = supabase
      .from('customers')
      .select('id, name, advance_balance, loyalty_points')
      .eq('id', customerId);
    const { data: primaryCust, error: custErr } = await custQ.maybeSingle();
    let cust = primaryCust;

    if (!cust) {
      const { data: fallbackCust } = await supabase.from('customers').select('id, name, advance_balance, loyalty_points').eq('id', customerId).maybeSingle();
      cust = fallbackCust;
    }

    if (custErr || !cust) throw new Error('Customer not found');

    let available = Number(cust.advance_balance || 0);
    if (available <= 0.009) {
      return { totalApplied: 0, billsUpdated: [], remainingAdvance: 0 };
    }

    const { data: bills, error: billsErr } = await supabase
      .from('bills')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true });

    if (billsErr) throw new Error(billsErr.message);

    const unpaidBills = (bills || []).filter(
      b => Number(b.paid_total || 0) < Number(b.grand_total || 0) - 0.009
    );

    let totalApplied = 0;
    let totalPointsEarned = 0;
    const billsUpdated: string[] = [];

    for (const b of unpaidBills) {
      if (available <= 0.009) break;

      const grandTotal = Number(b.grand_total || 0);
      const currentPaid = Number(b.paid_total || 0);
      const due = Number((grandTotal - currentPaid).toFixed(2));
      const allocate = Number(Math.min(due, available).toFixed(2));
      if (allocate <= 0) continue;

      const newPaidTotal = Number((currentPaid + allocate).toFixed(2));
      const newAdvanceUsed = Number((Number(b.advance_used || 0) + allocate).toFixed(2));
      const isNowFullyPaid = newPaidTotal >= grandTotal - 0.01;
      const hasDirect = Number(b.cash_paid || 0) + Number(b.upi_paid || 0) > 0;

      let newMethod = b.payment_method;
      if (!hasDirect) {
        newMethod = isNowFullyPaid ? 'Advance Used' : 'Pay Later';
      }

      const updateData: {
        paid_total: number;
        advance_used: number;
        payment_method: string;
        loyalty_points_earned?: number;
      } = {
        paid_total: newPaidTotal,
        advance_used: newAdvanceUsed,
        payment_method: newMethod
      };

      if (isNowFullyPaid && Number(b.loyalty_points_earned || 0) === 0 && grandTotal > 0) {
        const pointsEarned = await this.calculateLoyaltyPointsEarned(grandTotal);
        if (pointsEarned > 0) {
          const loySeq = await this.getNextSequence('LOYALTY');
          await supabase.from('loyalty_transactions').insert([{
            transaction_number: loySeq,
            customer_id: customerId,
            bill_id: b.id,
            points: pointsEarned,
            type: 'EARN',
            notes: `Award Reason: Bill Fully Paid (Advance Applied) - ${b.bill_number}`,
            ...(userId ? { user_id: userId } : {})
          }]);
          updateData.loyalty_points_earned = pointsEarned;
          totalPointsEarned += pointsEarned;
        }
      }

      const { error: updErr } = await supabase
        .from('bills')
        .update(updateData)
        .eq('id', b.id);

      if (updErr) throw new Error(updErr.message);

      available = Number((available - allocate).toFixed(2));
      totalApplied = Number((totalApplied + allocate).toFixed(2));
      billsUpdated.push(`${b.bill_number} (₹${allocate.toFixed(2)})`);
    }

    if (totalApplied > 0) {
      const newLoyalty = Math.max(0, Number(cust.loyalty_points || 0) + totalPointsEarned);
      await supabase
        .from('customers')
        .update({ advance_balance: Math.max(0, available), loyalty_points: newLoyalty })
        .eq('id', customerId);

      await this.logAudit({
        user_name: userName,
        action: 'APPLY_ADVANCE_TO_BILLS',
        entity: `Customer ${cust.name}`,
        previous_value: `Advance: ₹${Number(cust.advance_balance || 0).toFixed(2)}`,
        new_value: `Applied ₹${totalApplied.toFixed(2)} (FIFO) to ${billsUpdated.join(', ')}. Remaining advance: ₹${available.toFixed(2)}`
      });
    }

    return { totalApplied, billsUpdated, remainingAdvance: Math.max(0, available) };
  }


  /**
   * Allocate customer's available advance credit specifically to a chosen bill (e.g. BILL-0041).
   */
  static async applyAdvanceToBill(
    billId: string,
    customAmount?: number,
    userName = 'Admin'
  ): Promise<{ success: boolean; allocated: number; billNumber: string; remainingAdvance: number; newBillDue: number }> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const userId = await this.getUserId();

    const { data: bill, error: billErr } = await supabase
      .from('bills')
      .select('*')
      .eq('id', billId)
      .maybeSingle();

    if (billErr || !bill) throw new Error('Bill not found');
    if (!bill.customer_id) throw new Error('This bill is for a walk-in customer with no advance account.');

    const custQ = supabase
      .from('customers')
      .select('id, name, advance_balance, loyalty_points')
      .eq('id', bill.customer_id);
    const { data: primaryCust, error: custErr } = await custQ.maybeSingle();
    let cust = primaryCust;

    if (!cust) {
      const { data: fallbackCust } = await supabase.from('customers').select('id, name, advance_balance, loyalty_points').eq('id', bill.customer_id).maybeSingle();
      cust = fallbackCust;
    }

    if (custErr || !cust) throw new Error('Customer account not found');

    const availableAdvance = Number(cust.advance_balance || 0);
    if (availableAdvance <= 0.009) {
      throw new Error(`Customer ${cust.name} has no available advance balance (₹0.00).`);
    }

    const grandTotal = Number(bill.grand_total || 0);
    const currentPaid = Number(bill.paid_total || 0);
    const remainingDue = Number(Math.max(0, grandTotal - currentPaid).toFixed(2));

    if (remainingDue <= 0.009) {
      throw new Error(`Bill ${bill.bill_number} is already fully paid.`);
    }

    const requestedAmount = customAmount !== undefined && customAmount > 0 ? Number(customAmount) : remainingDue;
    const allocate = Number(Math.min(remainingDue, availableAdvance, requestedAmount).toFixed(2));

    if (allocate <= 0.009) {
      throw new Error('Allocation amount must be greater than ₹0.00');
    }

    const newPaidTotal = Number((currentPaid + allocate).toFixed(2));
    const newAdvanceUsed = Number((Number(bill.advance_used || 0) + allocate).toFixed(2));
    const isNowFullyPaid = newPaidTotal >= grandTotal - 0.01;
    const hasDirect = Number(bill.cash_paid || 0) + Number(bill.upi_paid || 0) > 0;

    let newMethod = bill.payment_method;
    if (!hasDirect) {
      newMethod = isNowFullyPaid ? 'Advance Used' : 'Pay Later';
    }

    const updateData: {
      paid_total: number;
      advance_used: number;
      payment_method: string;
      loyalty_points_earned?: number;
      edited_at: string;
      edited_by: string;
      edit_reason: string;
    } = {
      paid_total: newPaidTotal,
      advance_used: newAdvanceUsed,
      payment_method: newMethod,
      edited_at: new Date().toISOString(),
      edited_by: userName,
      edit_reason: `Allocated ₹${allocate.toFixed(2)} from customer advance`
    };

    let pointsEarnedOnBill = 0;
    if (isNowFullyPaid && Number(bill.loyalty_points_earned || 0) === 0 && grandTotal > 0) {
      const pointsEarned = await this.calculateLoyaltyPointsEarned(grandTotal);
      if (pointsEarned > 0) {
        const loySeq = await this.getNextSequence('LOYALTY');
        await supabase.from('loyalty_transactions').insert([{
          transaction_number: loySeq,
          customer_id: bill.customer_id,
          bill_id: bill.id,
          points: pointsEarned,
          type: 'EARN',
          notes: `Award Reason: Bill Fully Paid (Advance Allocated) - ${bill.bill_number}`,
          ...(userId ? { user_id: userId } : {})
        }]);
        updateData.loyalty_points_earned = pointsEarned;
        pointsEarnedOnBill = pointsEarned;
      }
    }

    const { error: updErr } = await supabase
      .from('bills')
      .update(updateData)
      .eq('id', bill.id);

    if (updErr) throw new Error(updErr.message);

    const newCustAdvance = Number(Math.max(0, availableAdvance - allocate).toFixed(2));
    const newCustLoyalty = Math.max(0, Number(cust.loyalty_points || 0) + pointsEarnedOnBill);
    await supabase
      .from('customers')
      .update({ advance_balance: newCustAdvance, loyalty_points: newCustLoyalty })
      .eq('id', bill.customer_id);

    const newBillDue = Number(Math.max(0, grandTotal - newPaidTotal).toFixed(2));

    await this.logAudit({
      user_name: userName,
      action: 'ALLOCATE_ADVANCE_TO_BILL',
      entity: `Bill ${bill.bill_number}`,
      previous_value: `Due: ₹${remainingDue.toFixed(2)}, Cust Advance: ₹${availableAdvance.toFixed(2)}`,
      new_value: `Allocated ₹${allocate.toFixed(2)} advance. Bill remaining due: ₹${newBillDue.toFixed(2)}, Cust remaining advance: ₹${newCustAdvance.toFixed(2)}`
    });

    return {
      success: true,
      allocated: allocate,
      billNumber: bill.bill_number,
      remainingAdvance: newCustAdvance,
      newBillDue
    };
  }


  static async deletePayment(
    paymentId: string,
    reason: string,
    adminPin: string,
    userName = 'Super Admin',
    overridePast48Hours = false
  ): Promise<boolean> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const settings = await this.getSettings();

    if (settings.security.super_admin_pin && settings.security.super_admin_pin !== adminPin) {
      throw new Error('Invalid Super Admin Security PIN. Delete rejected.');
    }

    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle();

    if (payErr || !payment) {
      return false;
    }

    if (payment.status === 'CANCELLED' || payment.status === 'REVERSED') {
      throw new Error('This payment has already been cancelled or reversed.');
    }

    const windowHours = Number(settings.security?.payment_reversal_window_hours) || 72;
    const paymentTime = new Date(payment.created_at).getTime();
    const elapsedHours = (Date.now() - paymentTime) / (1000 * 60 * 60);
    const isPastLimit = elapsedHours > windowHours;

    if (isPastLimit && !overridePast48Hours) {
      throw new Error(`Payment was recorded more than ${windowHours} hours ago. Super Admin ${windowHours}-Hour Override confirmation is required.`);
    }

    const amount = Number(payment.amount || 0);

    // If attached to a bill, deduct from bill paid_total (and reverse any advance_earned from overpayment)
    if (payment.bill_id) {
      const { data: bill } = await supabase
        .from('bills')
        .select('*')
        .eq('id', payment.bill_id)
        .maybeSingle();

      if (bill) {
        const grandTotal = Number(bill.grand_total || 0);
        const currentPaid = Number(bill.paid_total || 0);
        const billAdvanceEarned = Number(bill.advance_earned || 0);
        const directAppliedToBill = Math.max(0, amount - billAdvanceEarned);
        const newPaid = Number(Math.max(0, currentPaid - directAppliedToBill).toFixed(2));

        const currentCash = Number(bill.cash_paid || 0);
        const currentUpi = Number(bill.upi_paid || 0);
        let newCash = currentCash;
        let newUpi = currentUpi;
        if (payment.payment_method === 'UPI') {
          newUpi = Math.max(0, newUpi - amount);
        } else if (payment.payment_method === 'Cash') {
          newCash = Math.max(0, newCash - amount);
        } else if (payment.payment_method === 'Split Payment') {
          newCash = 0;
          newUpi = 0;
        }

        let newMethod = bill.payment_method;
        if (newPaid <= 0.01) newMethod = 'Pay Later';
        else if (newUpi > 0 && newCash === 0) newMethod = 'UPI';
        else if (newCash > 0 && newUpi === 0) newMethod = 'Cash';
        else if (newCash > 0 && newUpi > 0) newMethod = 'Split Payment';
        else if (Number(bill.advance_used || 0) > 0) newMethod = newPaid >= grandTotal - 0.01 ? 'Advance Used' : 'Pay Later';

        const updateData: {
          paid_total: number;
          cash_paid: number;
          upi_paid: number;
          advance_earned?: number;
          payment_method: string;
          loyalty_points_earned?: number;
        } = {
          paid_total: newPaid,
          cash_paid: newCash,
          upi_paid: newUpi,
          payment_method: newMethod
        };

        if (billAdvanceEarned > 0) {
          updateData.advance_earned = 0;
          if (bill.customer_id) {
            const { data: cust } = await supabase
              .from('customers')
              .select('advance_balance')
              .eq('id', bill.customer_id)
              .maybeSingle();

            if (cust) {
              const updatedAdv = Number(Math.max(0, Number(cust.advance_balance || 0) - billAdvanceEarned).toFixed(2));
              await supabase
                .from('customers')
                .update({ advance_balance: updatedAdv })
                .eq('id', bill.customer_id);
            }
          }
        }

        if (newPaid < grandTotal - 0.01 && Number(bill.loyalty_points_earned || 0) > 0) {
          await this.reverseLoyaltyPointsForBill(bill.id, userName);
          updateData.loyalty_points_earned = 0;
        }

        await supabase
          .from('bills')
          .update(updateData)
          .eq('id', payment.bill_id);
      }
    } else if (payment.customer_id) {
      const { data: cust } = await supabase
        .from('customers')
        .select('advance_balance')
        .eq('id', payment.customer_id)
        .maybeSingle();

      const currentAdvance = Number(cust?.advance_balance || 0);

      const { data: custBills } = await supabase
        .from('bills')
        .select('*')
        .eq('customer_id', payment.customer_id)
        .order('created_at', { ascending: false });

      // Identify portion of this specific payment that was credited to advance vs applied to bills
      let advanceCreditedFromThisPayment = 0;
      if (payment.notes) {
        const advMatch = payment.notes.match(/Advance Credited:\s*₹?([0-9.]+)/i);
        if (advMatch) {
          advanceCreditedFromThisPayment = Number(advMatch[1]) || 0;
        }
      }
      if (advanceCreditedFromThisPayment === 0 && !payment.bill_id) {
        const totalDuesAcrossBills = (custBills || []).reduce(
          (s, b) => s + Math.max(0, Number(b.grand_total || 0) - Number(b.paid_total || 0)),
          0
        );
        if (amount > totalDuesAcrossBills) {
          advanceCreditedFromThisPayment = Number((amount - totalDuesAcrossBills).toFixed(2));
        }
      }

      // Rollback only the advance amount created by THIS payment; never touch customer's separate advance or applied advance on bills
      const deductFromAdvance = Math.min(currentAdvance, advanceCreditedFromThisPayment);
      let remainingToReverseFromBills = Number((amount - advanceCreditedFromThisPayment).toFixed(2));

      if (cust && deductFromAdvance > 0) {
        const newAdvance = Number(Math.max(0, currentAdvance - deductFromAdvance).toFixed(2));
        await supabase
          .from('customers')
          .update({ advance_balance: newAdvance })
          .eq('id', payment.customer_id);
      }

      if (remainingToReverseFromBills > 0.009) {
        for (const b of (custBills || [])) {
          if (remainingToReverseFromBills <= 0.009) break;
          const bCash = Number(b.cash_paid || 0);
          const bUpi = Number(b.upi_paid || 0);
          const bDirect = bCash + bUpi;
          const bPaid = Number(b.paid_total || 0);
          const bAdvUsed = Number(b.advance_used || 0);
          const reversiblePaid = Math.max(0, bPaid - bAdvUsed);
          if (reversiblePaid <= 0.009) continue;

          const deduct = Number(Math.min(reversiblePaid, remainingToReverseFromBills).toFixed(2));
          const newPaid = Number(Math.max(0, bPaid - deduct).toFixed(2));
          let newCash = bCash;
          let newUpi = bUpi;
          if (payment.payment_method === 'UPI') {
            newUpi = Math.max(0, bUpi - deduct);
          } else if (payment.payment_method === 'Cash') {
            newCash = Math.max(0, bCash - deduct);
          } else if (bDirect > 0) {
            newCash = Math.max(0, bCash - deduct);
          }

          const grandTotal = Number(b.grand_total || 0);
          let newMethod = b.payment_method;
          if (newPaid <= 0.01) newMethod = 'Pay Later';
          else if (newUpi > 0 && newCash === 0) newMethod = 'UPI';
          else if (newCash > 0 && newUpi === 0) newMethod = 'Cash';
          else if (newCash > 0 && newUpi > 0) newMethod = 'Split Payment';
          else if (bAdvUsed > 0) newMethod = newPaid >= grandTotal - 0.01 ? 'Advance Used' : 'Pay Later';

          const bUpdate: Record<string, unknown> = {
            paid_total: newPaid,
            cash_paid: newCash,
            upi_paid: newUpi,
            payment_method: newMethod
          };

          if (newPaid < grandTotal - 0.01 && Number(b.loyalty_points_earned || 0) > 0) {
            await this.reverseLoyaltyPointsForBill(b.id, userName);
            bUpdate.loyalty_points_earned = 0;
          }

          await supabase
            .from('bills')
            .update(bUpdate)
            .eq('id', b.id);

          remainingToReverseFromBills = Number((remainingToReverseFromBills - deduct).toFixed(2));
        }
      }
    }

    // Soft delete payment record by updating status to CANCELLED
    const { error: cancelErr } = await supabase
      .from('payments')
      .update({
        status: 'CANCELLED',
        cancellation_reason: isPastLimit ? `[${windowHours}H Override] ${reason}` : reason,
        cancelled_at: new Date().toISOString(),
        cancelled_by: userName
      })
      .eq('id', paymentId);

    if (cancelErr) throw new Error(cancelErr.message);

    await this.logAudit({
      user_name: userName,
      action: isPastLimit ? `CANCEL_PAYMENT_OVERRIDE_${windowHours}H` : 'CANCEL_PAYMENT',
      entity: `Payment ${payment.payment_number || paymentId}`,
      previous_value: `Amount: ₹${amount}, Customer ID: ${payment.customer_id}`,
      new_value: `Payment cancelled/soft-deleted.${isPastLimit ? ` [SUPER ADMIN ${windowHours}H OVERRIDE]` : ''} Reason: ${reason}`
    });

    return true;
  }


  static async reconcileCustomerAdvanceBalances(userName = 'Super Admin'): Promise<{
    customersReconciled: number;
    discrepanciesFixed: number;
    duplicatesMerged: number;
    totalAdvanceBefore: number;
    totalAdvanceAfter: number;
  }> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    // 1. Fetch all customers, bills, payments, and loyalty transactions
    const custQ = supabase.from('customers').select('*');
    const billsQ = supabase
      .from('bills')
      .select('id, bill_number, customer_id, grand_total, paid_total, cash_paid, upi_paid, advance_used, advance_earned, payment_method, loyalty_points_earned, created_at')
      .order('created_at', { ascending: true });
    const payQ = supabase.from('payments').select('id, payment_number, customer_id, bill_id, amount, status, notes, created_at');
    const loyQ = supabase.from('loyalty_transactions').select('customer_id, points, type');

    const [
      { data: rawCustomers, error: custErr },
      { data: rawBills, error: billsErr },
      { data: rawPayments, error: payErr },
      { data: rawLoyalty, error: loyErr }
    ] = await Promise.all([custQ, billsQ, payQ, loyQ]);

    if (custErr) throw new Error(custErr.message);
    if (billsErr) throw new Error(billsErr.message);
    if (payErr) throw new Error(payErr.message);
    if (loyErr) throw new Error(loyErr.message);

    let custList = rawCustomers || [];
    const billList = rawBills || [];
    const payList = rawPayments || [];

    let duplicatesMerged = 0;
    let discrepanciesFixed = 0;
    const totalAdvanceBefore = custList.reduce((sum, c) => sum + Number(c.advance_balance || 0), 0);

    // 2. DETECT & MERGE DUPLICATE CUSTOMER ACCOUNTS (by trimmed normalized lowercase name)
    const nameGroups = new Map<string, Customer[]>();
    for (const c of custList) {
      const normName = c.name.trim().replace(/\s+/g, ' ').toLowerCase();
      const group = nameGroups.get(normName) || [];
      group.push(c);
      nameGroups.set(normName, group);
    }

    const mergedCustomerIds = new Set<string>();

    for (const [, group] of nameGroups.entries()) {
      if (group.length > 1) {
        // Earliest created is the primary account
        group.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
        const primary = group[0];
        const duplicates = group.slice(1);

        for (const dup of duplicates) {
          // Inherit contact details if primary is missing them
          const contactUpdates: Record<string, unknown> = {};
          if (!primary.mobile && dup.mobile) {
            primary.mobile = dup.mobile;
            contactUpdates.mobile = dup.mobile;
          }
          if (!primary.email && dup.email) {
            primary.email = dup.email;
            contactUpdates.email = dup.email;
          }
          if (Object.keys(contactUpdates).length > 0) {
            await supabase.from('customers').update(contactUpdates).eq('id', primary.id);
          }

          // Reassign all bills from dup to primary (including any legacy rows)
          await supabase.from('bills').update({ customer_id: primary.id }).eq('customer_id', dup.id);
          const dupBills = billList.filter(b => b.customer_id === dup.id);
          for (const b of dupBills) {
            b.customer_id = primary.id;
          }

          // Reassign all payments from dup to primary
          await supabase.from('payments').update({ customer_id: primary.id }).eq('customer_id', dup.id);
          const dupPayments = payList.filter(p => p.customer_id === dup.id);
          for (const p of dupPayments) {
            p.customer_id = primary.id;
          }

          // Reassign loyalty transactions from dup to primary
          await supabase.from('loyalty_transactions').update({ customer_id: primary.id }).eq('customer_id', dup.id);

          // Combine opening advance / loyalty if dup had any
          if (Number(dup.advance_balance || 0) > 0) {
            primary.advance_balance = Number(primary.advance_balance || 0) + Number(dup.advance_balance || 0);
          }
          if (Number(dup.loyalty_points || 0) > 0) {
            primary.loyalty_points = Number(primary.loyalty_points || 0) + Number(dup.loyalty_points || 0);
          }

          // Delete redundant duplicate customer record
          const { error: delCustErr } = await supabase.from('customers').delete().eq('id', dup.id);
          if (!delCustErr) {
            mergedCustomerIds.add(dup.id);
            duplicatesMerged++;

            await this.logAudit({
              user_name: userName,
              action: 'MERGE_DUPLICATE_CUSTOMER',
              entity: `Customer ${primary.name}`,
              new_value: `Merged duplicate profile (${dup.customer_code || dup.id}) with ${dupBills.length} bills into primary (${primary.customer_code || primary.id})`
            });
          }
        }
      }
    }

    // Refresh active customer list after merging duplicates
    custList = custList.filter(c => !mergedCustomerIds.has(c.id));

    // 3. RECONCILE BILL ALLOCATIONS (FIFO) AND REAL ADVANCE BALANCES ACROSS ALL CUSTOMERS
    let totalAdvanceAfter = 0;
    let customersReconciled = 0;

    for (const cust of custList) {
      const storedAdvance = Number(cust.advance_balance || 0);
      const custLoyaltyPoints = Number(cust.loyalty_points || 0);

      const custBills = billList
        .filter(b => b.customer_id === cust.id)
        .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

      // Cap any individual bill whose paid_total exceeds grand_total
      for (const b of custBills) {
        const gTotal = Number(b.grand_total || 0);
        const pTotal = Number(b.paid_total || 0);
        if (pTotal > gTotal + 0.009) {
          b.paid_total = gTotal;
          await supabase.from('bills').update({ paid_total: gTotal }).eq('id', b.id);
          discrepanciesFixed++;
        }
      }

      // Unified ledger calculation across payments and bills
      const custPayments = payList.filter(p => p.customer_id === cust.id && p.status !== 'CANCELLED' && p.status !== 'REVERSED');
      const totalBilled = Number(custBills.reduce((s, b) => s + Number(b.grand_total || 0), 0).toFixed(2));
      const totalBillPaid = Number(custBills.reduce((s, b) => s + Number(b.paid_total || 0), 0).toFixed(2));
      const totalPaymentsVouchers = Number(custPayments.reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(2));
      const totalCustomerPaid = Math.max(totalPaymentsVouchers, totalBillPaid);

      const calculatedAdvance = Math.max(0, Number((totalCustomerPaid - totalBilled).toFixed(2)));

      totalAdvanceAfter += calculatedAdvance;

      const custTxs = (rawLoyalty || []).filter(t => t.customer_id === cust.id);
      const calculatedLoyalty = custTxs.length > 0
        ? Math.max(0, custTxs.reduce((sum, t) => sum + (t.type === 'REDEEM' ? -Math.abs(Number(t.points || 0)) : Number(t.points || 0)), 0))
        : custLoyaltyPoints;

      const advDiff = Math.abs(calculatedAdvance - storedAdvance) > 0.001;
      const loyDiff = custTxs.length > 0 && Math.abs(custLoyaltyPoints - calculatedLoyalty) > 0.001;

      if (advDiff || loyDiff) {
        await supabase
          .from('customers')
          .update({
            advance_balance: calculatedAdvance,
            loyalty_points: calculatedLoyalty
          })
          .eq('id', cust.id);

        discrepanciesFixed++;
      }
      customersReconciled++;
    }

    await this.logAudit({
      user_name: userName,
      action: 'RECONCILE_ADVANCE_BALANCES',
      entity: 'All Customers',
      new_value: `Reconciled ${customersReconciled} customers, merged ${duplicatesMerged} duplicate accounts, fixed ${discrepanciesFixed} balance discrepancies. Advance before: ₹${totalAdvanceBefore.toFixed(2)}, after: ₹${totalAdvanceAfter.toFixed(2)}`
    });

    return {
      customersReconciled,
      discrepanciesFixed,
      duplicatesMerged,
      totalAdvanceBefore: Number(totalAdvanceBefore.toFixed(2)),
      totalAdvanceAfter: Number(totalAdvanceAfter.toFixed(2))
    };
  }


  static async getExpenses(): Promise<Expense[]> {
    if (!isSupabaseConfigured) return [];

    const query = supabase
      .from('expenses')
      .select('*');

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];

    return (data || []).map((exp: Record<string, unknown>) => {
      let cash = exp.cash_amount !== undefined && exp.cash_amount !== null ? Number(exp.cash_amount) : undefined;
      let upi = exp.upi_amount !== undefined && exp.upi_amount !== null ? Number(exp.upi_amount) : undefined;

      if (cash === undefined || isNaN(cash)) {
        if (exp.payment_mode === 'Cash') cash = Number(exp.amount || 0);
        else if (exp.payment_mode === 'UPI') cash = 0;
        else if (typeof exp.notes === 'string' && exp.notes.includes('[Split:')) {
          const match = exp.notes.match(/Cash\s*₹?\s*(\d+(?:\.\d+)?)/i);
          cash = match ? Number(match[1]) : 0;
        } else {
          cash = 0;
        }
      }

      if (upi === undefined || isNaN(upi)) {
        if (exp.payment_mode === 'UPI') upi = Number(exp.amount || 0);
        else if (exp.payment_mode === 'Cash') upi = 0;
        else if (typeof exp.notes === 'string' && exp.notes.includes('[Split:')) {
          const match = exp.notes.match(/UPI\s*₹?\s*(\d+(?:\.\d+)?)/i);
          upi = match ? Number(match[1]) : 0;
        } else {
          upi = 0;
        }
      }

      return {
        ...(exp as unknown as Expense),
        amount: Number(exp.amount || 0),
        cash_amount: cash,
        upi_amount: upi
      };
    });
  }


  static async addExpense(expense: {
    title: string;
    amount: number;
    category: string;
    payment_mode?: string;
    cash_amount?: number;
    upi_amount?: number;
    notes?: string;
    created_at?: string;
  }, userName = 'Admin'): Promise<Expense> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const userId = await this.getUserId();
    const expense_number = await this.getNextSequence('EXPENSE');

    const totalAmt = Number(expense.amount || 0);
    const mode = expense.payment_mode || 'Cash';
    let cashAmt = 0;
    let upiAmt = 0;

    if (mode === 'Split') {
      cashAmt = Number(expense.cash_amount || 0);
      upiAmt = Number(expense.upi_amount || 0);
    } else if (mode === 'Cash') {
      cashAmt = totalAmt;
      upiAmt = 0;
    } else if (mode === 'UPI') {
      cashAmt = 0;
      upiAmt = totalAmt;
    } else {
      cashAmt = Number(expense.cash_amount || 0);
      upiAmt = Number(expense.upi_amount || 0);
    }

    let noteText = expense.notes || '';
    if (mode === 'Split' && !noteText.includes('[Split:')) {
      const splitBadge = `[Split: Cash ₹${cashAmt}, UPI ₹${upiAmt}]`;
      noteText = noteText ? `${noteText} ${splitBadge}` : splitBadge;
    }

    const payload: Record<string, unknown> = {
      title: expense.title,
      amount: totalAmt,
      category: expense.category,
      payment_mode: mode,
      notes: noteText || null,
      expense_number,
      ...(expense.created_at ? { created_at: expense.created_at } : {}),
      ...(userId ? { user_id: userId } : {})
    };

    const { data, error } = await supabase
      .from('expenses')
      .insert([payload])
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Failed to create expense');

    await this.logAudit({
      user_name: userName,
      action: 'CREATE_EXPENSE',
      entity: `Expense ${expense.title}`,
      new_value: JSON.stringify(data)
    });

    return {
      ...data,
      amount: totalAmt,
      cash_amount: cashAmt,
      upi_amount: upiAmt
    };
  }


  static async deleteExpense(id: string, adminPin?: string, userName = 'Admin'): Promise<boolean> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    // Verify existence
    const { data: existing } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return false;
    }

    // Check if expense falls into a closed accounting session
    const isClosed = await this.isDateInClosedSession(existing.created_at);
    if (isClosed.isClosed) {
      const settings = await this.getSettings();
      if (!adminPin || (settings.security.super_admin_pin && settings.security.super_admin_pin !== adminPin)) {
        throw new Error('This expense is inside a locked closed accounting period. Valid Super Admin PIN required to delete.');
      }
    }

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    await this.logAudit({
      user_name: userName,
      action: 'DELETE_EXPENSE',
      entity: `Expense ID ${id}`
    });

    return true;
  }


  static async addExpenseCategory(categoryName: string, userName = 'Admin'): Promise<string[]> {
    const trimmed = categoryName.trim();
    if (!trimmed) throw new Error('Category name cannot be empty');

    const settings = await this.getSettings();
    const currentCats = settings.expenses?.categories || [];

    if (currentCats.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`Category "${trimmed}" already exists.`);
    }

    const updated = [...currentCats, trimmed];
    await this.saveSettings('expenses', {
      ...(settings.expenses || DEFAULT_SETTINGS.expenses),
      categories: updated
    }, userName);

    return updated;
  }


  static async removeExpenseCategory(categoryName: string, userName = 'Admin'): Promise<string[]> {
    const settings = await this.getSettings();
    const currentCats = settings.expenses?.categories || [];
    const updated = currentCats.filter(c => c.toLowerCase() !== categoryName.toLowerCase());

    await this.saveSettings('expenses', {
      ...(settings.expenses || DEFAULT_SETTINGS.expenses),
      categories: updated
    }, userName);

    return updated;
  }


  static async purgeAllBusinessData(userName = 'Super Admin'): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    const delBillItems = supabase.from('bill_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const delPayments = supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const delBills = supabase.from('bills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const delExpenses = supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const delLoyalty = supabase.from('loyalty_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const updateCust = supabase.from('customers').update({ advance_balance: 0, loyalty_points: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');

    await delBillItems;
    await delPayments;
    await delBills;
    await delExpenses;
    await delLoyalty;
    await updateCust;

    await this.logAudit({
      user_name: userName,
      action: 'PURGE_ALL_BUSINESS_DATA',
      entity: 'All Business Records'
    });
  }


  static async getDashboardStats(filter: DateFilterOption = 'today', customRange?: { from: string; to: string }): Promise<DashboardStats> {
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (filter === 'current_session') {
      const latestClosing = await this.getLatestAccountingClosing();
      if (latestClosing?.to_date) {
        startDate = new Date(latestClosing.to_date);
      }
    } else {
      const bounds = this.getDateRangeBounds(filter, customRange);
      startDate = bounds.startDate;
      endDate = bounds.endDate;
    }

    if (!isSupabaseConfigured) {
      const emptySummary: PaymentSummary = {
        total_sales: 0,
        cash_collected: 0,
        upi_collected: 0,
        total_amount_collected: 0,
        outstanding_amount: 0,
        customer_advance_balance: 0,
        payment_method_breakdown: [],
        daily_collection_trend: [],
        monthly_collection_trend: []
      };
      return {
        todays_sales: 0,
        monthly_sales: 0,
        todays_bills_count: 0,
        pending_balance: 0,
        total_customers: 0,
        total_income: 0,
        total_expense: 0,
        net_profit: 0,
        bills_generated: 0,
        average_bill_value: 0,
        payment_summary: emptySummary,
        sales_trend: [],
        monthly_revenue: [],
        payment_distribution: [],
        top_products: []
      };
    }

    let billsQuery = supabase.from('bills').select('*, bill_items(*)');
    let paymentsQuery = supabase.from('payments').select('*');
    let expensesQuery = supabase.from('expenses').select('*');

    if (startDate) {
      billsQuery = billsQuery.gte('created_at', startDate.toISOString());
      paymentsQuery = paymentsQuery.gte('created_at', startDate.toISOString());
      expensesQuery = expensesQuery.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      billsQuery = billsQuery.lte('created_at', endDate.toISOString());
      paymentsQuery = paymentsQuery.lte('created_at', endDate.toISOString());
      expensesQuery = expensesQuery.lte('created_at', endDate.toISOString());
    }

    const [
      { data: bills },
      { data: payments },
      { data: expenses }
    ] = await Promise.all([
      billsQuery.order('created_at', { ascending: false }),
      paymentsQuery.order('created_at', { ascending: false }),
      expensesQuery.order('created_at', { ascending: false })
    ]);

    const allBills = bills || [];
    const allPayments = (payments || []).filter(p => p.status !== 'CANCELLED' && p.status !== 'REVERSED');
    const allExpenses = expenses || [];

    const custQuery = supabase.from('customers').select('id, name, advance_balance');
    const allBillsDueQuery = supabase.from('bills').select('id, customer_id, grand_total, paid_total, cash_paid, upi_paid, advance_used');

    const [{ data: custRows }, { data: allTimeBillsForDue }] = await Promise.all([
      custQuery,
      allBillsDueQuery
    ]);
    const total_customers = custRows?.length || 0;
    const total_advance = (custRows || []).reduce((sum, c) => sum + Number(c.advance_balance || 0), 0);
    const pending_balance = (allTimeBillsForDue || allBills).reduce(
      (sum, b) => sum + Math.max(0, Number(b.grand_total || 0) - Number(b.paid_total || 0)),
      0
    );

    const billsLookup = new Map<string, { cash_paid?: number; upi_paid?: number }>();
    (allTimeBillsForDue || []).forEach(b => billsLookup.set(b.id, b));
    allBills.forEach(b => billsLookup.set(b.id, b));

    const paymentBillIds = new Set(allPayments.map(p => p.bill_id).filter(Boolean));

    let cashCollected = 0;
    let upiCollected = 0;

    allPayments.forEach(p => {
      const amt = Number(p.amount || 0);
      if (p.payment_method === 'Cash') {
        cashCollected += amt;
      } else if (p.payment_method === 'UPI') {
        upiCollected += amt;
      } else if (p.payment_method === 'Split Payment') {
        const linked = p.bill_id ? billsLookup.get(p.bill_id) : undefined;
        if (linked && (Number(linked.cash_paid || 0) + Number(linked.upi_paid || 0) > 0)) {
          cashCollected += Number(linked.cash_paid || 0);
          upiCollected += Number(linked.upi_paid || 0);
        } else {
          cashCollected += amt;
        }
      }
    });

    allBills.forEach(b => {
      // Include direct cash/upi from any bill without a registered payment voucher
      if (!paymentBillIds.has(b.id)) {
        cashCollected += Number(b.cash_paid || 0);
        upiCollected += Number(b.upi_paid || 0);
      }
    });

    const totalAmountCollected = cashCollected + upiCollected;
    const totalSales = allBills.reduce((sum, b) => sum + Number(b.grand_total || 0), 0);
    const bills_generated = allBills.length;
    const average_bill_value = bills_generated > 0 ? totalSales / bills_generated : 0;

    const total_income = totalAmountCollected;
    const total_expense = allExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const net_profit = total_income - total_expense;

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthly_sales = allBills
      .filter(b => b.created_at.startsWith(currentMonth))
      .reduce((sum, b) => sum + Number(b.grand_total || 0), 0);

    const paymentSummary: PaymentSummary = {
      total_sales: totalSales,
      cash_collected: cashCollected,
      upi_collected: upiCollected,
      total_amount_collected: totalAmountCollected,
      outstanding_amount: pending_balance,
      customer_advance_balance: total_advance,
      payment_method_breakdown: [
        { method: 'Cash', amount: cashCollected },
        { method: 'UPI', amount: upiCollected },
        { method: 'Total Collected', amount: totalAmountCollected }
      ],
      daily_collection_trend: [],
      monthly_collection_trend: []
    };

    const salesTrendMap = new Map<string, number>();
    allBills.forEach(b => {
      const dateKey = new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      salesTrendMap.set(dateKey, (salesTrendMap.get(dateKey) || 0) + Number(b.grand_total || 0));
    });
    const sales_trend = Array.from(salesTrendMap.entries()).map(([date, amount]) => ({ date, amount }));

    const monthlyRevMap = new Map<string, number>();
    allBills.forEach(b => {
      const monthKey = new Date(b.created_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      monthlyRevMap.set(monthKey, (monthlyRevMap.get(monthKey) || 0) + Number(b.grand_total || 0));
    });
    const monthly_revenue = Array.from(monthlyRevMap.entries()).map(([month, amount]) => ({ month, amount }));

    const payment_distribution = [
      { name: 'Cash', value: cashCollected },
      { name: 'UPI', value: upiCollected }
    ].filter(p => p.value > 0);

    const prodMap = new Map<string, { quantity: number; revenue: number }>();
    allBills.forEach(b => {
      ((b.bill_items || []) as BillItem[]).forEach((item: BillItem) => {
        const name = item.product_name;
        const existing = prodMap.get(name) || { quantity: 0, revenue: 0 };
        prodMap.set(name, {
          quantity: existing.quantity + Number(item.quantity || 0),
          revenue: existing.revenue + Number(item.total || 0)
        });
      });
    });

    const top_products = Array.from(prodMap.entries())
      .map(([name, stat]) => ({ name, quantity: stat.quantity, revenue: stat.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      todays_sales: totalSales,
      monthly_sales,
      todays_bills_count: bills_generated,
      pending_balance,
      total_customers,
      total_income,
      total_expense,
      net_profit,
      bills_generated,
      average_bill_value,
      payment_summary: paymentSummary,
      sales_trend,
      monthly_revenue,
      payment_distribution,
      top_products
    };
  }

  static getDateRangeBounds(filter: DateFilterOption, customRange?: { from: string; to: string }): {
    startDate?: Date;
    endDate?: Date;
  } {
    const now = new Date();
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    switch (filter) {
      case 'today':
        return { startDate, endDate };
      case 'yesterday':
        startDate.setDate(startDate.getDate() - 1);
        endDate.setDate(endDate.getDate() - 1);
        return { startDate, endDate };
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        return { startDate, endDate };
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1);
        return { startDate, endDate };
      case 'quarterly':
        startDate.setMonth(startDate.getMonth() - 3);
        return { startDate, endDate };
      case 'yearly':
        startDate.setFullYear(startDate.getFullYear() - 1);
        return { startDate, endDate };
      case 'financial_year':
        const currentYear = now.getFullYear();
        const fyStart = now.getMonth() >= 3 ? new Date(currentYear, 3, 1) : new Date(currentYear - 1, 3, 1);
        return { startDate: fyStart, endDate };
      case 'custom':
        if (customRange?.from && customRange?.to) {
          return {
            startDate: new Date(customRange.from),
            endDate: new Date(customRange.to)
          };
        }
        return {};
      default:
        return {};
    }
  }

  // --- WHATSAPP TEXT RECEIPT GENERATOR ---
  // --- DIGITAL MULTI-CHANNEL RECEIPT GENERATOR (WhatsApp, Telegram, SMS, Social) ---

  static generateDigitalReceiptText(
    bill: Bill,
    financialSummary?: BillFinancialSummary,
    shopSettings?: Partial<ShopSettings>
  ): string {
    const formattedDate = new Date(bill.created_at || Date.now()).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const shopName = shopSettings?.shop_name || 'SIMPLEBILLING STORE';
    const shopPhone = shopSettings?.phone ? `📞 Ph: ${shopSettings.phone}` : '';
    const shopAddress = shopSettings?.address ? `📍 ${shopSettings.address}` : '';
    const shopGstin = shopSettings?.gst_number ? `🏛️ GSTIN: ${shopSettings.gst_number}` : '';
    const footerMsg = shopSettings?.footer_message || 'Thank you for your business!';

    const itemsText = (bill.items || []).map((item, idx) =>
      `${idx + 1}. *${item.product_name}*\n   Qty: ${item.quantity} × ₹${Number(item.price).toFixed(2)} = ₹${Number(item.total).toFixed(2)}`
    ).join('\n\n');

    const isFullyPaidFallback = Math.max(0, Number(bill.grand_total || 0) - Number(bill.paid_total || 0)) <= 0.01;
    const ptsEarnedFallback = Number(bill.loyalty_points_earned || 0);

    const summary: BillFinancialSummary = financialSummary || bill.financial_summary || {
      previous_outstanding: 0,
      previous_advance: 0,
      current_bill_amount: Number(bill.grand_total || 0),
      total_amount_due: Number(bill.grand_total || 0),
      cash_paid: Number(bill.cash_paid || 0),
      upi_paid: Number(bill.upi_paid || 0),
      advance_used: Number(bill.advance_used || 0),
      total_paid: Number(bill.paid_total || 0),
      remaining_balance: Math.max(0, Number(bill.grand_total || 0) - Number(bill.paid_total || 0)),
      remaining_advance_balance: Number(bill.advance_earned || 0),
      payment_status: isFullyPaidFallback ? 'Fully Paid' : 'Payment Pending',
      loyalty: ptsEarnedFallback > 0 ? {
        enabled: true,
        is_fully_paid: isFullyPaidFallback,
        points_awarded: isFullyPaidFallback,
        previous_points: 0,
        points_earned: ptsEarnedFallback,
        points_redeemed: Number(bill.loyalty_points_redeemed || 0),
        current_points_balance: ptsEarnedFallback,
        message: isFullyPaidFallback ? `🎁 Loyalty Earned: +${ptsEarnedFallback} Points` : `⏳ Loyalty Points will be credited after this bill is fully paid.`
      } : undefined
    };

    const statusBadge = summary.payment_status === 'Fully Paid'
      ? 'Status: Fully Paid ✅'
      : summary.payment_status === 'Partially Paid'
        ? `Status: Partially Paid ℹ️ (Remaining: ₹${summary.remaining_balance.toFixed(2)})`
        : `Status: Payment Pending ⚠️ (Remaining: ₹${summary.remaining_balance.toFixed(2)})`;

    const currentBillDue = Math.max(0, summary.current_bill_amount - summary.total_paid);
    const advanceEarnedOnBill = Number(bill.advance_earned || 0);

    let text = `🧾 *${shopName.toUpperCase()}*`;
    if (shopAddress) text += `\n${shopAddress}`;
    if (shopPhone || shopGstin) {
      text += `\n${[shopPhone, shopGstin].filter(Boolean).join(' | ')}`;
    }

    text += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 *TAX INVOICE / BILL RECEIPT*
Bill No: *${bill.bill_number}*
Date: ${formattedDate}
Customer: *${bill.customer_name || 'Walk-in Customer'}* ${bill.customer_mobile ? `(${bill.customer_mobile})` : ''}
Payment Mode: *${bill.payment_method || 'Cash'}*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛒 *ITEMIZED PURCHASES*

${itemsText || '1. General Purchase\n   Qty: 1 × ₹' + Number(bill.grand_total).toFixed(2) + ' = ₹' + Number(bill.grand_total).toFixed(2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *BILL TOTALS*
Subtotal: ₹${Number(bill.total || 0).toFixed(2)}
Discount: -₹${Number(bill.discount || 0).toFixed(2)}`;

    if (Number(bill.gst_amount || 0) > 0) {
      text += `\nGST: +₹${Number(bill.gst_amount).toFixed(2)}`;
    }
    if (Number(bill.rounding_adjustment || 0) !== 0) {
      text += `\nRounding: ${Number(bill.rounding_adjustment) >= 0 ? '+' : ''}₹${Number(bill.rounding_adjustment).toFixed(2)}`;
    }

    text += `\n🧾 *Grand Total: ₹${Number(bill.grand_total || 0).toFixed(2)}*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *CUSTOMER ACCOUNT SUMMARY*
Previous Outstanding: ₹${summary.previous_outstanding.toFixed(2)}`;

    if (summary.previous_advance > 0.009) {
      text += `\nPrevious Advance: ₹${summary.previous_advance.toFixed(2)}`;
    }

    text += `\nCurrent Bill Amount: ₹${summary.current_bill_amount.toFixed(2)}
*Total Amount Due: ₹${summary.total_amount_due.toFixed(2)}*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 *PAYMENT SUMMARY*
Cash Paid: ₹${summary.cash_paid.toFixed(2)}
UPI Paid: ₹${summary.upi_paid.toFixed(2)}
Advance Used: ₹${summary.advance_used.toFixed(2)}
*Total Paid: ₹${summary.total_paid.toFixed(2)}*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚖️ *BALANCE & ADVANCE SUMMARY*
Current Bill Due: ₹${currentBillDue.toFixed(2)}
Net Account Balance Due: ₹${summary.remaining_balance.toFixed(2)}`;

    if (advanceEarnedOnBill > 0) {
      text += `\n🔵 *Advance Credited (This Bill): +₹${advanceEarnedOnBill.toFixed(2)}*`;
    }
    if (summary.remaining_advance_balance > 0.009) {
      text += `\nCustomer Advance Wallet: ₹${summary.remaining_advance_balance.toFixed(2)}`;
    }
    text += `\nCustomer Advance Balance: ₹${summary.remaining_advance_balance.toFixed(2)}
📌 ${statusBadge}`;

    if (summary.loyalty && summary.loyalty.enabled) {
      text += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *LOYALTY REWARDS*`;
      if (summary.remaining_balance <= 0.01 || summary.loyalty.is_fully_paid) {
        text += `\nPoints Earned (This Bill): *+${summary.loyalty.points_earned} Pts*
Previous Points: ${summary.loyalty.previous_points} pts
Points Redeemed: -${summary.loyalty.points_redeemed} pts
*Current Active Loyalty Balance: ${summary.loyalty.current_points_balance} pts*`;
      } else {
        const totalPending = summary.loyalty.total_pending_points || summary.loyalty.points_earned;
        text += `\n⏳ *Points on This Bill (Pending): +${summary.loyalty.points_earned} Pts*
⏳ *Total Pending on Account: ${totalPending} Pts*
Available Spendable Balance: ${summary.loyalty.previous_points} pts
_(Points will be credited upon bill settlement)_`;
      }
    }

    text += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${footerMsg}\n_Powered by SimpleBilling_`;

    return text;
  }

  // Backwards compatibility alias

  static generateWhatsAppTextReceipt(bill: Bill, financialSummary?: BillFinancialSummary, shopSettings?: Partial<ShopSettings>): string {
    return this.generateDigitalReceiptText(bill, financialSummary, shopSettings);
  }

  // --- HTML EMAIL RECEIPT TEMPLATE GENERATOR ---

  static generateEmailHtmlReceipt(
    bill: Bill,
    financialSummary?: BillFinancialSummary,
    shopSettings?: Partial<ShopSettings>
  ): string {
    const shopName = shopSettings?.shop_name || 'SimpleBilling Center';
    const shopPhone = shopSettings?.phone || '';
    const shopAddress = shopSettings?.address || '';
    const shopGstin = shopSettings?.gst_number || '';
    const footerMsg = shopSettings?.footer_message || 'Thank you for your business!';

    const itemsRows = (bill.items || []).map((item, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
        <td style="padding: 8px 4px; text-align: left;">${idx + 1}. ${item.product_name}</td>
        <td style="padding: 8px 4px; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px 4px; text-align: right;">₹${Number(item.price).toFixed(2)}</td>
        <td style="padding: 8px 4px; text-align: right; font-weight: bold;">₹${Number(item.total).toFixed(2)}</td>
      </tr>
    `).join('');

    const summary: BillFinancialSummary = financialSummary || bill.financial_summary || {
      previous_outstanding: 0,
      previous_advance: 0,
      current_bill_amount: Number(bill.grand_total || 0),
      total_amount_due: Number(bill.grand_total || 0),
      cash_paid: Number(bill.cash_paid || 0),
      upi_paid: Number(bill.upi_paid || 0),
      advance_used: Number(bill.advance_used || 0),
      total_paid: Number(bill.paid_total || 0),
      remaining_balance: Math.max(0, Number(bill.grand_total || 0) - Number(bill.paid_total || 0)),
      remaining_advance_balance: Number(bill.advance_earned || 0),
      payment_status: (Number(bill.paid_total || 0) >= Number(bill.grand_total || 0) - 0.01) ? 'Fully Paid' : 'Payment Pending'
    };

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #0f172a; color: #ffffff; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">${shopName.toUpperCase()}</h1>
          ${shopAddress ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">${shopAddress}</p>` : ''}
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
            ${shopPhone ? `Ph: ${shopPhone}` : ''} ${shopGstin ? `| GSTIN: ${shopGstin}` : ''}
          </p>
        </div>

        <div style="padding: 20px;">
          <div style="background: #f8fafc; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; font-size: 13px;">
            <div>
              <p style="margin: 0; font-weight: bold; color: #0f172a;">Invoice #${bill.bill_number}</p>
              <p style="margin: 2px 0 0 0; color: #64748b; font-size: 12px;">Customer: ${bill.customer_name || 'Valued Customer'}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">Date: ${new Date(bill.created_at || Date.now()).toLocaleDateString('en-IN')}</p>
              <p style="margin: 2px 0 0 0; font-weight: bold; color: ${summary.remaining_balance <= 0.01 ? '#15803d' : '#b45309'}; font-size: 12px;">Status: ${summary.payment_status}</p>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background: #f1f5f9; color: #475569; font-size: 11px; text-transform: uppercase;">
                <th style="padding: 8px 4px; text-align: left;">Item</th>
                <th style="padding: 8px 4px; text-align: center;">Qty</th>
                <th style="padding: 8px 4px; text-align: right;">Price</th>
                <th style="padding: 8px 4px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div style="background: #f8fafc; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: #64748b;">Subtotal:</span>
              <span style="font-weight: 600;">₹${Number(bill.total || 0).toFixed(2)}</span>
            </div>
            ${Number(bill.discount || 0) > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #15803d;">
                <span>Discount:</span>
                <span>-₹${Number(bill.discount).toFixed(2)}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; border-top: 2px solid #cbd5e1; padding-top: 8px; margin-top: 8px; color: #0f172a;">
              <span>Grand Total:</span>
              <span>₹${Number(bill.grand_total || 0).toFixed(2)}</span>
            </div>
          </div>

          <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 12px;">
            <p style="margin: 0 0 8px 0; font-weight: 700; text-transform: uppercase; color: #475569; font-size: 11px; letter-spacing: 0.5px;">Account & Payment Summary</p>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px; color: #64748b;">
              <span>Total Paid:</span>
              <span style="font-weight: 600; color: #15803d;">₹${summary.total_paid.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px; color: #64748b;">
              <span>Current Bill Due:</span>
              <span style="font-weight: 600; color: ${summary.remaining_balance > 0 ? '#b45309' : '#15803d'};">₹${summary.remaining_balance.toFixed(2)}</span>
            </div>
            ${Number(bill.advance_earned || 0) > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 3px; color: #4338ca; font-weight: bold;">
                <span>Advance Credited (This Bill):</span>
                <span>+₹${Number(bill.advance_earned).toFixed(2)}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; color: #64748b;">
              <span>Customer Advance Balance:</span>
              <span style="font-weight: 600;">₹${summary.remaining_advance_balance.toFixed(2)}</span>
            </div>
          </div>

          <div style="text-align: center; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
            <p style="margin: 0;">${footerMsg}</p>
            <p style="margin: 4px 0 0 0;">Generated by SimpleBilling</p>
          </div>
        </div>
      </div>
    `;
  }

  // --- DATABASE SEED UTILITY ---


  static async seedDefaultCatalogAndCustomers(userName = 'Super Admin'): Promise<{ productsAdded: number; customersAdded: number }> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const userId = await this.getUserId();

    const seedProducts = [
      { product_code: 'PRD-000001', name: 'A4 B/W Xerox (Single)', price: 2.00, category: 'Printing & Xerox', ...(userId ? { user_id: userId } : {}) },
      { product_code: 'PRD-000002', name: 'A4 B/W Xerox (Back-to-Back)', price: 3.00, category: 'Printing & Xerox', ...(userId ? { user_id: userId } : {}) },
      { product_code: 'PRD-000003', name: 'A4 Color Printout', price: 10.00, category: 'Printing & Xerox', ...(userId ? { user_id: userId } : {}) },
      { product_code: 'PRD-000004', name: 'Spiral Binding (upto 100 pgs)', price: 40.00, category: 'Binding & Finishing', ...(userId ? { user_id: userId } : {}) },
      { product_code: 'PRD-000005', name: 'A4 Document Lamination', price: 25.00, category: 'Binding & Finishing', ...(userId ? { user_id: userId } : {}) },
      { product_code: 'PRD-000006', name: 'Passport Size Photo (Set of 8)', price: 50.00, category: 'Photography', ...(userId ? { user_id: userId } : {}) },
      { product_code: 'PRD-000007', name: 'Classmate Notebook (Long)', price: 65.00, category: 'Stationery', ...(userId ? { user_id: userId } : {}) },
      { product_code: 'PRD-000008', name: 'Reynolds Ball Pen (Blue)', price: 10.00, category: 'Stationery', ...(userId ? { user_id: userId } : {}) }
    ];

    const seedCustomers = [
      { customer_code: 'CUS-000001', name: 'Rahul Sharma', mobile: '9876543210', email: 'rahul.s@example.com', advance_balance: 150.00, loyalty_points: 25.00, ...(userId ? { user_id: userId } : {}) },
      { customer_code: 'CUS-000002', name: 'Pooja Patel', mobile: '9823456789', email: 'pooja.p@example.com', advance_balance: 0.00, loyalty_points: 10.00, ...(userId ? { user_id: userId } : {}) },
      { customer_code: 'CUS-000003', name: 'Dr. Ramesh Gupta', mobile: '9123456780', email: 'dr.gupta@clinic.org', advance_balance: 500.00, loyalty_points: 80.00, ...(userId ? { user_id: userId } : {}) }
    ];

    const { error: pErr } = await supabase.from('products').insert(seedProducts);
    const { error: cErr } = await supabase.from('customers').insert(seedCustomers);

    if (pErr) console.warn('Products seed note:', pErr.message);
    if (cErr) console.warn('Customers seed note:', cErr.message);

    await this.logAudit({
      user_name: userName,
      action: 'SEED_CATALOG',
      entity: 'Default Catalog & Customers'
    });

    return { productsAdded: seedProducts.length, customersAdded: seedCustomers.length };
  }


  static async getProductSalesAnalytics(
    productId: string,
    filter: DateFilterOption = 'all_time',
    customRange?: { from: string; to: string }
  ): Promise<ProductSalesAnalytics> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    const isCustom = productId.startsWith('custom:');
    let product: Product;

    if (isCustom) {
      const decodedName = decodeURIComponent(productId.replace('custom:', ''));
      product = {
        id: productId,
        name: decodedName,
        price: 0,
        category: 'Custom Service / Item',
        created_at: new Date().toISOString()
      };
    } else {
      const p = await this.getProductById(productId);
      if (!p) {
        return {
          product: {
            id: productId,
            name: 'Not Found',
            price: 0,
            category: 'Unknown',
            created_at: new Date().toISOString()
          },
          total_quantity_sold: 0,
          total_revenue: 0,
          average_selling_rate: 0,
          orders_count: 0,
          transactions: []
        };
      }
      product = p;
    }

    const { startDate, endDate } = this.getDateRangeBounds(filter, customRange);

    let query = supabase
      .from('bill_items')
      .select('*, bills(id, bill_number, created_at, customer_id, customers!fk_bills_customer(name), total, grand_total, discount)');

    if (isCustom) {
      query = query.is('product_id', null).eq('product_name', product.name);
    } else {
      query = query.or(`product_id.eq.${productId},product_name.eq.${product.name}`);
    }

    const { data: items, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching product sales history:', error);
      return {
        product,
        total_quantity_sold: 0,
        total_revenue: 0,
        average_selling_rate: product.price,
        orders_count: 0,
        transactions: []
      };
    }

    const transactions: ProductSalesHistoryItem[] = [];
    const billIds = new Set<string>();
    let totalQty = 0;
    let totalRev = 0;

    for (const item of (items || [])) {
      const bill = item.bills as { 
        id?: string; 
        bill_number?: string; 
        created_at?: string; 
        customer_id?: string; 
        customers?: { name?: string }; 
        customer_name?: string;
        total?: number;
        grand_total?: number;
        discount?: number;
      } | null;
      const createdAt = bill?.created_at || item.created_at || new Date().toISOString();
      const itemTime = new Date(createdAt).getTime();

      if (startDate && itemTime < startDate.getTime()) continue;
      if (endDate && itemTime > endDate.getTime()) continue;

      const qty = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      const rawTotal = Number(item.total || (qty * price));

      // Calculate net earned total after proportional bill discount deduction
      const billSubtotal = Number(bill?.total || 0);
      const billGrandTotal = Number(bill?.grand_total || 0);
      const factor = (billSubtotal > 0 && billGrandTotal > 0) ? (billGrandTotal / billSubtotal) : 1;
      const total = Number((rawTotal * factor).toFixed(2));

      const isCustomRate = isCustom ? false : Math.abs(price - product.price) > 0.001;

      const billId = bill?.id || item.bill_id || '';
      if (billId) billIds.add(billId);

      totalQty += qty;
      totalRev += total;

      const customerName = bill?.customers?.name || bill?.customer_name || 'Walk-in Customer';

      transactions.push({
        bill_id: billId,
        bill_number: bill?.bill_number || 'N/A',
        created_at: createdAt,
        customer_id: bill?.customer_id || null,
        customer_name: customerName,
        quantity: qty,
        price,
        total,
        is_custom_rate: isCustomRate,
        catalog_price: product.price
      });
    }

    transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const avgRate = totalQty > 0 ? Number((totalRev / totalQty).toFixed(2)) : product.price;

    return {
      product: {
        ...product,
        price: isCustom ? avgRate : product.price
      },
      total_quantity_sold: Number(totalQty.toFixed(2)),
      total_revenue: Number(totalRev.toFixed(2)),
      average_selling_rate: avgRate,
      orders_count: billIds.size,
      transactions
    };
  }


  static async getCustomItemsAnalytics(
    filter: DateFilterOption = 'all_time',
    customRange?: { from: string; to: string }
  ): Promise<CustomItemAnalytics[]> {
    if (!isSupabaseConfigured) return [];

    const { startDate, endDate } = this.getDateRangeBounds(filter, customRange);

    const query = supabase
      .from('bill_items')
      .select('*')
      .is('product_id', null);

    const { data: customItems, error } = await query.order('created_at', { ascending: false });

    if (error || !customItems) {
      console.error('Error fetching custom items:', error);
      return [];
    }

    const itemMap = new Map<string, {
      name: string;
      total_quantity: number;
      total_revenue: number;
      rates: number[];
      bill_ids: Set<string>;
      first_used_at: string;
      last_used_at: string;
    }>();

    for (const item of customItems) {
      const itemTime = new Date(item.created_at).getTime();
      if (startDate && itemTime < startDate.getTime()) continue;
      if (endDate && itemTime > endDate.getTime()) continue;

      const rawItem = item as Record<string, unknown>;
      const resolvedName = (item.product_name && item.product_name !== 'Custom Item')
        ? item.product_name
        : String(rawItem.item_name || '');
      const name = resolvedName.trim();
      if (!name || name === 'Custom Item') continue;

      const qty = Number(item.quantity ?? rawItem.qty ?? 0);
      const price = Number(item.price ?? rawItem.unit_price ?? 0);
      const total = Number(item.total ?? rawItem.amount ?? (qty * price));

      if (!itemMap.has(name)) {
        itemMap.set(name, {
          name,
          total_quantity: 0,
          total_revenue: 0,
          rates: [],
          bill_ids: new Set<string>(),
          first_used_at: item.created_at,
          last_used_at: item.created_at
        });
      }

      const entry = itemMap.get(name)!;
      entry.total_quantity += qty;
      entry.total_revenue += total;
      entry.rates.push(price);
      if (item.bill_id) entry.bill_ids.add(item.bill_id);
      if (new Date(item.created_at).getTime() > new Date(entry.last_used_at).getTime()) {
        entry.last_used_at = item.created_at;
      }
      if (new Date(item.created_at).getTime() < new Date(entry.first_used_at).getTime()) {
        entry.first_used_at = item.created_at;
      }
    }

    return Array.from(itemMap.values()).map(entry => {
      const avgRate = entry.total_quantity > 0
        ? Number((entry.total_revenue / entry.total_quantity).toFixed(2))
        : (entry.rates[0] || 0);

      const minRate = Math.min(...entry.rates);
      const maxRate = Math.max(...entry.rates);
      const isDynamic = entry.rates.length > 1 && (maxRate - minRate > 0.01);

      return {
        name: entry.name,
        total_quantity: Number(entry.total_quantity.toFixed(2)),
        total_revenue: Number(entry.total_revenue.toFixed(2)),
        average_selling_rate: avgRate,
        is_dynamic_rate: isDynamic,
        min_rate: minRate,
        max_rate: maxRate,
        orders_count: entry.bill_ids.size,
        first_used_at: entry.first_used_at,
        last_used_at: entry.last_used_at
      };
    }).sort((a, b) => b.total_revenue - a.total_revenue);
  }


  static async getCustomerStatementData(
    customerId: string,
    filter: DateFilterOption = 'all_time',
    customRange?: { from: string; to: string }
  ): Promise<CustomerStatementData | null> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');

    const { data: primaryCustomer, error: custErr } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .maybeSingle();
    let customer = primaryCustomer;

    if (!customer) {
      const { data: fallbackCust } = await supabase.from('customers').select('*').eq('id', customerId).maybeSingle();
      customer = fallbackCust;
    }

    if (custErr || !customer) {
      return null;
    }

    const settings = await this.getSettings();

    const [billsRes, paymentsRes] = await Promise.all([
      supabase
        .from('bills')
        .select('*, bill_items(*)')
        .or(`customer_id.eq.${customerId},paid_by_customer_id.eq.${customerId}`)
        .order('created_at', { ascending: true }),
      supabase
        .from('payments')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: true })
    ]);

    const bills = billsRes.data || [];
    const payments = paymentsRes.data || [];
    const activePayments = payments.filter(p => p.status !== 'CANCELLED' && p.status !== 'REVERSED');

    const totalAllTimeBilled = Number((bills || []).reduce((sum, b) => sum + Number(b.grand_total || 0), 0).toFixed(2));
    const totalBillPaid = Number((bills || []).reduce((sum, b) => sum + Number(b.paid_total || 0), 0).toFixed(2));
    const totalPaymentsVouchers = Number(activePayments.reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(2));
    const totalCustomerPaid = Math.max(totalPaymentsVouchers, totalBillPaid);

    const currentOutstandingBalance = Number((bills || []).reduce((sum, b) => sum + Math.max(0, Number(b.grand_total || 0) - Number(b.paid_total || 0)), 0).toFixed(2));
    const currentAdvanceBalance = totalCustomerPaid > totalAllTimeBilled ? Number((totalCustomerPaid - totalAllTimeBilled).toFixed(2)) : 0.00;

    const stmtStoredAdvBefore = Number(customer.advance_balance || 0);
    customer.advance_balance = currentAdvanceBalance;
    if (Math.abs(stmtStoredAdvBefore - currentAdvanceBalance) > 0.001) {
      await supabase.from('customers').update({ advance_balance: currentAdvanceBalance }).eq('id', customerId);
    }

    const stmtBillMap = new Map((bills || []).map(b => [b.id, b]));
    const stmtInitialPaymentByBillId = new Map<string, (typeof activePayments)[0]>();
    const stmtMergedPaymentIds = new Set<string>();

    for (const p of activePayments) {
      if (p.bill_id && stmtBillMap.has(p.bill_id)) {
        const b = stmtBillMap.get(p.bill_id)!;
        const diffSec = (new Date(p.created_at).getTime() - new Date(b.created_at).getTime()) / 1000;
        const hasInitialInNotes = p.notes && p.notes.toLowerCase().includes('initial');
        if ((diffSec >= -5 && diffSec <= 30) || hasInitialInNotes) {
          stmtInitialPaymentByBillId.set(b.id, p);
          stmtMergedPaymentIds.add(p.id);
        }
      }
    }

    const { startDate, endDate } = this.getDateRangeBounds(filter, customRange);

    // Compute Opening Balance as of start date (prior debits minus prior credits)
    let openingBalance = 0;
    if (startDate) {
      const priorDebits = (bills || [])
        .filter(b => new Date(b.created_at).getTime() < startDate.getTime())
        .reduce((sum, b) => sum + Number(b.grand_total || 0), 0);

      const priorBillPaid = (bills || [])
        .filter(b => new Date(b.created_at).getTime() < startDate.getTime())
        .reduce((sum, b) => sum + Number(b.paid_total || 0), 0);

      const priorVouchers = activePayments
        .filter(p => new Date(p.created_at).getTime() < startDate.getTime())
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const priorCredits = Math.max(priorVouchers, priorBillPaid);
      openingBalance = Number((priorDebits - priorCredits).toFixed(2));
    }

    const filteredBills: CustomerStatementBill[] = [];
    const transactionsList: CustomerStatementTransaction[] = [];
    let periodUnits = 0;

    // 1. Invoices in period (Single Clean Row with Dr = Total, Cr = Checkout Paid)
    for (const b of (bills || [])) {
      const bTime = new Date(b.created_at).getTime();
      if (startDate && bTime < startDate.getTime()) continue;
      if (endDate && bTime > endDate.getTime()) continue;

      const grandTotal = Number(b.grand_total || 0);
      const advUsed = Number(b.advance_used || 0);
      let payMethod = b.payment_method || 'Cash';

      const initialPayment = stmtInitialPaymentByBillId.get(b.id);
      let paidAmount = 0;
      let payRef = '';

      if (initialPayment) {
        paidAmount = Number(initialPayment.amount || 0);
        payMethod = initialPayment.payment_method || payMethod;
        payRef = initialPayment.payment_number;
      } else {
        paidAmount = Math.max(0, Number(b.paid_total || 0) - advUsed);
      }

      const directPaid = Math.min(grandTotal, paidAmount);
      const totalSettledOnBill = Number((directPaid + advUsed).toFixed(2));
      const balanceDue = Math.max(0, Number((grandTotal - totalSettledOnBill).toFixed(2)));
      const isFullyPaid = balanceDue <= 0.009;
      const discount = Number(b.discount || 0);
      const subtotal = Number(b.total || (grandTotal + discount));

      const items: CustomerStatementBillItem[] = ((b.bill_items as BillItem[]) || []).map((item, idx) => {
        const qty = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        const total = Number(item.total || (qty * price));
        periodUnits += qty;
        return {
          item_index: idx + 1,
          product_id: item.product_id || null,
          product_name: item.product_name,
          is_custom_item: !item.product_id,
          quantity: qty,
          price,
          total
        };
      });

      filteredBills.push({
        bill_id: b.id,
        bill_number: b.bill_number,
        created_at: b.created_at,
        items,
        subtotal,
        discount,
        grand_total: grandTotal,
        paid_amount: totalSettledOnBill,
        balance_due: balanceDue,
        advance_used: advUsed,
        advance_earned: Number(b.advance_earned || 0)
      });

      const itemsSummary = items.map(i => `${i.product_name} (${i.quantity})`).join(', ');
      let billParticulars = itemsSummary || 'Sales Invoice Billed';
      if (initialPayment) {
        if (advUsed > 0) {
          billParticulars += ` [Paid: ₹${advUsed.toFixed(2)} Adv + ₹${paidAmount.toFixed(2)} ${payMethod} via ${payRef}]`;
        } else {
          billParticulars += ` [Paid at checkout via ${payMethod} (${payRef})]`;
        }
      } else if (advUsed > 0 && directPaid > 0) {
        billParticulars += ` [Paid: ₹${advUsed.toFixed(2)} Adv + ₹${directPaid.toFixed(2)} ${payMethod}]`;
      } else if (advUsed > 0) {
        billParticulars += ` [Paid: ₹${advUsed.toFixed(2)} Advance]`;
      } else if (directPaid > 0) {
        billParticulars += ` [Paid at checkout via ${payMethod}]`;
      } else if (payMethod && payMethod !== 'Pay Later') {
        billParticulars += ` [Mode: ${payMethod}]`;
      }

      transactionsList.push({
        id: `stmt-bill-${b.id}`,
        date: b.created_at,
        type: 'INVOICE',
        reference_no: b.bill_number,
        particulars: billParticulars,
        debit: grandTotal,
        credit: paidAmount,
        running_balance: 0,
        advance_used: advUsed,
        direct_paid: directPaid,
        bill_due: balanceDue,
        is_fully_paid: isFullyPaid,
        payment_method: payMethod,
        items
      });
    }

    // 2. Standalone / Delayed Payment Vouchers in period (Credit events)
    let paymentsCount = 0;
    for (const p of activePayments) {
      if (stmtMergedPaymentIds.has(p.id)) continue; // Merged into bill invoice row!

      const pTime = new Date(p.created_at).getTime();
      if (startDate && pTime < startDate.getTime()) continue;
      if (endDate && pTime > endDate.getTime()) continue;

      const amt = Number(p.amount || 0);
      paymentsCount++;

      transactionsList.push({
        id: `stmt-pay-${p.id}`,
        date: p.created_at,
        type: 'PAYMENT',
        reference_no: p.payment_number || 'PAY',
        particulars: p.notes || `Payment received via ${p.payment_method || 'Cash'}`,
        debit: 0,
        credit: amt,
        running_balance: 0,
        payment_method: p.payment_method || 'Cash'
      });
    }

    // Sort transactions chronologically; when timestamps match, INVOICE precedes PAYMENT
    transactionsList.sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (diff !== 0) return diff;
      return a.type === 'INVOICE' ? -1 : 1;
    });

    // Calculate chronological running balance starting from opening balance
    let ledgerRunner = openingBalance;
    const finalTransactions = transactionsList.map(t => {
      ledgerRunner += (t.debit - t.credit);
      return {
        ...t,
        running_balance: Number(ledgerRunner.toFixed(2))
      };
    });

    const periodTotalInvoiced = Number(transactionsList.reduce((sum, t) => sum + t.debit, 0).toFixed(2));
    const periodTotalPaid = Number(transactionsList.reduce((sum, t) => sum + t.credit, 0).toFixed(2));
    const closingBalance = Number(ledgerRunner.toFixed(2));

    const dateMap = new Map<string, CustomerStatementBill[]>();
    for (const bill of filteredBills) {
      const d = new Date(bill.created_at);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(bill);
    }

    const date_groups: CustomerStatementDateGroup[] = Array.from(dateMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([rawDate, billsOnDate]) => {
        const d = new Date(rawDate);
        const formatted = d.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        return {
          raw_date: rawDate,
          date_formatted: formatted,
          bills: billsOnDate
        };
      });

    // Financial Summary Aggregations
    let totalCashReceived = 0;
    let totalUpiReceived = 0;
    let totalMixedPayments = 0;
    let totalAdvanceReceived = 0;
    let totalAdvanceUtilized = 0;
    const totalAdvanceRefunded = 0;
    const totalBillRefunds = 0;

    for (const p of activePayments) {
      const pTime = new Date(p.created_at).getTime();
      if (startDate && pTime < startDate.getTime()) continue;
      if (endDate && pTime > endDate.getTime()) continue;

      const amt = Number(p.amount || 0);
      const mode = (p.payment_method || '').toLowerCase();
      if (mode.includes('upi')) {
        totalUpiReceived += amt;
      } else if (mode.includes('split') || mode.includes('mixed')) {
        totalMixedPayments += amt;
      } else {
        totalCashReceived += amt;
      }

      if (p.notes && p.notes.toLowerCase().includes('advance')) {
        totalAdvanceReceived += amt;
      }
    }

    for (const b of filteredBills) {
      totalAdvanceUtilized += Number(b.advance_used || 0);
    }

    let filterLabel = 'All Transactions';
    if (filter === 'today') filterLabel = 'Today';
    else if (filter === 'weekly') filterLabel = 'This Week';
    else if (filter === 'monthly') filterLabel = 'This Month';
    else if (filter === 'quarterly') filterLabel = 'This Quarter';
    else if (filter === 'financial_year') filterLabel = 'Financial Year (FY)';
    else if (filter === 'custom' && customRange?.from && customRange?.to) {
      filterLabel = `${customRange.from} to ${customRange.to}`;
    }

    return {
      customer,
      shop_settings: settings.shop,
      period: {
        filter_label: filterLabel,
        start_date: startDate?.toISOString(),
        end_date: endDate?.toISOString()
      },
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      current_advance_balance: currentAdvanceBalance,
      current_balance_due: currentOutstandingBalance,
      financial_summary: {
        opening_balance: openingBalance,
        total_bills: filteredBills.length,
        total_billed: periodTotalInvoiced,
        total_cash_received: Number(totalCashReceived.toFixed(2)),
        total_upi_received: Number(totalUpiReceived.toFixed(2)),
        total_mixed_payments: Number(totalMixedPayments.toFixed(2)),
        total_advance_received: Number(totalAdvanceReceived.toFixed(2)),
        total_advance_utilized: Number(totalAdvanceUtilized.toFixed(2)),
        total_advance_refunded: Number(totalAdvanceRefunded.toFixed(2)),
        total_bill_refunds: Number(totalBillRefunds.toFixed(2)),
        total_outstanding: currentOutstandingBalance,
        closing_balance: closingBalance
      },
      kpi: {
        total_invoiced: periodTotalInvoiced,
        total_paid: periodTotalPaid,
        invoices_count: filteredBills.length,
        payments_count: paymentsCount,
        total_units_bought: Number(periodUnits.toFixed(2))
      },
      transactions: finalTransactions,
      date_groups,
      reconciliation: {
        period_purchases: periodTotalInvoiced,
        period_payments: periodTotalPaid,
        current_outstanding_balance: currentOutstandingBalance,
        advance_balance: currentAdvanceBalance
      }
    };
  }

  // =========================================================================
  // INTERNAL TRANSFERS (CONTRA VOUCHERS: CASH <-> UPI CONVERSIONS)
  // =========================================================================

  private static getLocalTransfers(): InternalTransfer[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('sb_internal_transfers');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private static setLocalTransfers(transfers: InternalTransfer[]): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('sb_internal_transfers', JSON.stringify(transfers));
    } catch { }
  }

  private static hasInternalTransfersTable: boolean | null = typeof window !== 'undefined' && window.sessionStorage?.getItem('sb_table_internal_transfers') === 'false' ? false : null;
  private static hasAccountingClosingsTable: boolean | null = typeof window !== 'undefined' && window.sessionStorage?.getItem('sb_table_accounting_closings') === 'false' ? false : null;
  private static inFlightTransfersPromise: Promise<InternalTransfer[]> | null = null;
  private static inFlightClosingsPromise: Promise<AccountingClosing[]> | null = null;

  static resetAccountingTablesCache(): void {
    this.hasInternalTransfersTable = null;
    this.hasAccountingClosingsTable = null;
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage?.removeItem('sb_table_internal_transfers');
        window.sessionStorage?.removeItem('sb_table_accounting_closings');
      } catch { }
    }
  }

  static isAccountingUsingLocalStorage(): boolean {
    return this.hasAccountingClosingsTable === false || this.hasInternalTransfersTable === false;
  }

  static async getInternalTransfers(): Promise<InternalTransfer[]> {
    if (!isSupabaseConfigured || this.hasInternalTransfersTable === false) return this.getLocalTransfers();
    if (this.inFlightTransfersPromise) return this.inFlightTransfersPromise;

    this.inFlightTransfersPromise = (async () => {
      try {
        const query = supabase.from('internal_transfers').select('*');
        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.code === '42P01') {
            this.hasInternalTransfersTable = false;
            if (typeof window !== 'undefined') {
              try { window.sessionStorage?.setItem('sb_table_internal_transfers', 'false'); } catch { }
            }
          }
          return this.getLocalTransfers();
        }
        this.hasInternalTransfersTable = true;
        if (typeof window !== 'undefined') {
          try { window.sessionStorage?.removeItem('sb_table_internal_transfers'); } catch { }
        }
        return data || [];
      } catch {
        return this.getLocalTransfers();
      } finally {
        this.inFlightTransfersPromise = null;
      }
    })();

    return this.inFlightTransfersPromise;
  }

  static async createInternalTransfer(transfer: {
    direction: 'CASH_TO_UPI' | 'UPI_TO_CASH';
    amount: number;
    reason: string;
    reference_no?: string;
    notes?: string;
    created_at?: string;
  }, userName = 'Admin'): Promise<InternalTransfer> {
    const userId = await this.getUserId();
    const transfer_number = await this.getNextSequence('TRANS');
    const record: InternalTransfer = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `trans_${Date.now()}`,
      user_id: userId,
      transfer_number,
      direction: transfer.direction,
      amount: Number(transfer.amount),
      reason: transfer.reason,
      reference_no: transfer.reference_no || null,
      notes: transfer.notes || null,
      created_at: transfer.created_at || new Date().toISOString()
    };

    if (isSupabaseConfigured && this.hasInternalTransfersTable !== false) {
      try {
        const { data, error } = await supabase
          .from('internal_transfers')
          .insert([record])
          .select()
          .maybeSingle();

        if (!error && data) {
          await this.logAudit({
            user_name: userName,
            action: 'CREATE_TRANSFER',
            entity: `Transfer ${transfer.direction} ₹${transfer.amount}`,
            new_value: JSON.stringify(data)
          });
          return data;
        } else if (error && (error.code === 'PGRST205' || error.message?.includes('schema cache'))) {
          this.hasInternalTransfersTable = false;
          if (typeof window !== 'undefined') {
            try { window.sessionStorage?.setItem('sb_table_internal_transfers', 'false'); } catch { }
          }
        }
      } catch (err) {
        console.warn('Supabase internal_transfers fallback to local:', err);
      }
    }

    // Local storage fallback
    const local = this.getLocalTransfers();
    const updated = [record, ...local];
    this.setLocalTransfers(updated);

    await this.logAudit({
      user_name: userName,
      action: 'CREATE_TRANSFER',
      entity: `Transfer ${transfer.direction} ₹${transfer.amount}`,
      new_value: JSON.stringify(record)
    });

    return record;
  }

  static async deleteInternalTransfer(id: string, adminPin?: string, userName = 'Admin'): Promise<boolean> {
    const settings = await this.getSettings();
    if (adminPin && settings.security.super_admin_pin && settings.security.super_admin_pin !== adminPin) {
      throw new Error('Invalid Super Admin Security PIN. Delete rejected.');
    }

    if (isSupabaseConfigured && this.hasInternalTransfersTable !== false) {
      try {
        const { data: existing } = await supabase
          .from('internal_transfers')
          .select('id')
          .eq('id', id)
          .maybeSingle();

        if (!existing) return false;

        await supabase
          .from('internal_transfers')
          .delete()
          .eq('id', id);
      } catch { }
    }

    const local = this.getLocalTransfers();
    this.setLocalTransfers(local.filter(t => t.id !== id));

    await this.logAudit({
      user_name: userName,
      action: 'DELETE_TRANSFER',
      entity: `Transfer ${id}`
    });

    return true;
  }

  // =========================================================================
  // ACCOUNTING CLOSINGS (PERIOD CLOSING & AUDIT RECONCILIATION)
  // =========================================================================

  private static normalizeClosingRecord(c: AccountingClosing): AccountingClosing {
    if (!c) return c;
    // If to_date was stored as end-of-day (23:59:59.999Z) beyond the actual closed_at timestamp,
    // clamp to_date to closed_at so transactions created later on the same day belong to the new session.
    if (c.closed_at && c.to_date) {
      const closedMs = new Date(c.closed_at).getTime();
      const toMs = new Date(c.to_date).getTime();
      if (!isNaN(closedMs) && !isNaN(toMs) && toMs > closedMs) {
        return { ...c, to_date: c.closed_at };
      }
    }
    return c;
  }

  private static getLocalClosings(): AccountingClosing[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('sb_accounting_closings');
      const parsed: AccountingClosing[] = raw ? JSON.parse(raw) : [];
      return parsed.map(c => this.normalizeClosingRecord(c));
    } catch {
      return [];
    }
  }

  private static setLocalClosings(closings: AccountingClosing[]): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('sb_accounting_closings', JSON.stringify(closings));
    } catch { }
  }

  static async getAccountingClosings(): Promise<AccountingClosing[]> {
    if (!isSupabaseConfigured || this.hasAccountingClosingsTable === false) return this.getLocalClosings();
    if (this.inFlightClosingsPromise) return this.inFlightClosingsPromise;

    this.inFlightClosingsPromise = (async () => {
      try {
        const query = supabase.from('accounting_closings').select('*');
        const { data, error } = await query.order('closed_at', { ascending: false });

        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.code === '42P01') {
            this.hasAccountingClosingsTable = false;
            if (typeof window !== 'undefined') {
              try { window.sessionStorage?.setItem('sb_table_accounting_closings', 'false'); } catch { }
            }
          }
          return this.getLocalClosings();
        }
        this.hasAccountingClosingsTable = true;
        if (typeof window !== 'undefined') {
          try { window.sessionStorage?.removeItem('sb_table_accounting_closings'); } catch { }
        }
        return (data || []).map(c => this.normalizeClosingRecord(c));
      } catch {
        return this.getLocalClosings();
      } finally {
        this.inFlightClosingsPromise = null;
      }
    })();

    return this.inFlightClosingsPromise;
  }

  static async getLatestAccountingClosing(): Promise<AccountingClosing | null> {
    const closings = await this.getAccountingClosings();
    if (!closings || closings.length === 0) return null;
    return closings[0];
  }

  static async createAccountingClosing(
    closingData: Omit<AccountingClosing, 'id' | 'closing_number' | 'closed_at'>,
    adminPin: string,
    userName = 'Admin'
  ): Promise<AccountingClosing> {
    const settings = await this.getSettings();
    if (settings.security.super_admin_pin && settings.security.super_admin_pin !== adminPin) {
      throw new Error('Invalid Super Admin Security PIN. Closing rejected.');
    }

    const closedAtIso = new Date().toISOString();
    const effectiveToDate = new Date(closingData.to_date).getTime() > new Date(closedAtIso).getTime()
      ? closedAtIso
      : closingData.to_date;

    // Strict Zero-Dues Enforcement: Ensure all session bills are completed without pending dues
    const reconCheck = await this.calculateReconciliationForRange(closingData.from_date, effectiveToDate);
    if (reconCheck.pending_session_dues > 0.01) {
      throw new Error(
        `Cannot close accounting session: ${reconCheck.unpaid_bills.length} bills in this period have outstanding dues totaling ₹${reconCheck.pending_session_dues.toFixed(2)}. All session dues must be fully completed before closing.`
      );
    }

    const userId = await this.getUserId();
    const closing_number = await this.getNextSequence('CLOSE');

    // Explicit allowlist: map only permitted closing fields; enforce system control over status, is_locked, and timestamps
    const record: AccountingClosing = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `close_${Date.now()}`,
      user_id: userId,
      closing_number,
      from_date: closingData.from_date,
      to_date: effectiveToDate,
      opening_cash: Number(closingData.opening_cash || 0),
      opening_upi: Number(closingData.opening_upi || 0),
      opening_advance_pool: Number(closingData.opening_advance_pool || 0),
      cash_inflow: Number(closingData.cash_inflow || 0),
      upi_inflow: Number(closingData.upi_inflow || 0),
      advance_received: Number(closingData.advance_received || 0),
      advance_utilized: Number(closingData.advance_utilized || 0),
      closing_advance_pool: Number(closingData.closing_advance_pool || 0),
      cash_outflow: Number(closingData.cash_outflow || 0),
      upi_outflow: Number(closingData.upi_outflow || 0),
      transfers_cash_to_upi: Number(closingData.transfers_cash_to_upi || 0),
      transfers_upi_to_cash: Number(closingData.transfers_upi_to_cash || 0),
      expected_cash: Number(closingData.expected_cash || 0),
      expected_upi: Number(closingData.expected_upi || 0),
      actual_cash: Number(closingData.actual_cash || 0),
      actual_upi: Number(closingData.actual_upi || 0),
      cash_difference: Number(closingData.cash_difference || 0),
      upi_difference: Number(closingData.upi_difference || 0),
      discrepancy_note: closingData.discrepancy_note ? String(closingData.discrepancy_note).trim() : null,
      denominations: closingData.denominations || undefined,
      status: 'CLOSED',
      is_locked: true,
      closed_by: userName,
      closed_at: closedAtIso,
      last_audited_at: null,
      last_audited_by: null,
      audit_notes: null
    };

    if (isSupabaseConfigured && this.hasAccountingClosingsTable !== false) {
      try {
        const payload: Record<string, unknown> = { ...record };
        let { data, error } = await supabase
          .from('accounting_closings')
          .insert([payload])
          .select()
          .maybeSingle();

        if (error && (error.message?.includes('column') || error.code === '42703')) {
          delete payload.opening_advance_pool;
          delete payload.advance_received;
          delete payload.advance_utilized;
          delete payload.closing_advance_pool;
          delete payload.denominations;
          const retry = await supabase.from('accounting_closings').insert([payload]).select().maybeSingle();
          data = retry.data;
          error = retry.error;
        }

        if (!error && data) {
          await this.logAudit({
            user_name: userName,
            action: 'CLOSE_ACCOUNTING_PERIOD',
            entity: `Session ${closing_number} (${closingData.from_date.slice(0, 10)} to ${closingData.to_date.slice(0, 10)})`,
            new_value: JSON.stringify({ ...data, ...record })
          });
          return { ...record, ...data };
        } else if (error && (error.code === 'PGRST205' || error.message?.includes('schema cache'))) {
          this.hasAccountingClosingsTable = false;
          if (typeof window !== 'undefined') {
            try { window.sessionStorage?.setItem('sb_table_accounting_closings', 'false'); } catch { }
          }
        }
      } catch (err) {
        console.warn('Supabase accounting_closings fallback to local:', err);
      }
    }

    // Local storage fallback
    const local = this.getLocalClosings();
    const updated = [record, ...local];
    this.setLocalClosings(updated);

    await this.logAudit({
      user_name: userName,
      action: 'CLOSE_ACCOUNTING_PERIOD',
      entity: `Session ${closing_number} (${closingData.from_date.slice(0, 10)} to ${closingData.to_date.slice(0, 10)})`,
      new_value: JSON.stringify(record)
    });

    return record;
  }

  static async updateAccountingClosing(
    id: string,
    updates: Partial<AccountingClosing>,
    adminPin: string,
    userName = 'Admin'
  ): Promise<AccountingClosing | null> {
    const settings = await this.getSettings();
    if (settings.security.super_admin_pin && settings.security.super_admin_pin !== adminPin) {
      throw new Error('Invalid Super Admin Security PIN. Audit update rejected.');
    }

    // Explicit allowlist for auditing/editing a closed session: drop id, user_id, closing_number, status, is_locked
    const auditUpdates: Record<string, unknown> = {
      last_audited_at: new Date().toISOString(),
      last_audited_by: userName
    };
    if (updates.actual_cash !== undefined) {
      auditUpdates.actual_cash = Number(updates.actual_cash || 0);
    }
    if (updates.actual_upi !== undefined) {
      auditUpdates.actual_upi = Number(updates.actual_upi || 0);
    }
    if (updates.cash_difference !== undefined) {
      auditUpdates.cash_difference = Number(updates.cash_difference || 0);
    }
    if (updates.upi_difference !== undefined) {
      auditUpdates.upi_difference = Number(updates.upi_difference || 0);
    }
    if (updates.discrepancy_note !== undefined) {
      auditUpdates.discrepancy_note = updates.discrepancy_note ? String(updates.discrepancy_note).trim() : null;
    }
    if (updates.audit_notes !== undefined) {
      auditUpdates.audit_notes = updates.audit_notes ? String(updates.audit_notes).trim() : null;
    }
    if (updates.denominations !== undefined) {
      auditUpdates.denominations = updates.denominations;
    }

    if (isSupabaseConfigured && this.hasAccountingClosingsTable !== false) {
      try {
        const { data, error } = await supabase
          .from('accounting_closings')
          .update(auditUpdates)
          .eq('id', id)
          .select()
          .maybeSingle();

        if (!error && data) {
          await this.logAudit({
            user_name: userName,
            action: 'AUDIT_ACCOUNTING_PERIOD',
            entity: `Session ${data.closing_number || id}`,
            new_value: JSON.stringify(data)
          });
          return data;
        }
      } catch { }
    }

    const local = this.getLocalClosings();
    const index = local.findIndex(c => c.id === id);
    if (index === -1) return null;

    const updatedObj: AccountingClosing = { ...local[index], ...auditUpdates };
    local[index] = updatedObj;
    this.setLocalClosings(local);

    await this.logAudit({
      user_name: userName,
      action: 'AUDIT_ACCOUNTING_PERIOD',
      entity: `Session ${updatedObj.closing_number || id}`,
      new_value: JSON.stringify(updatedObj)
    });

    return updatedObj;
  }

  static async deleteAccountingClosing(id: string, adminPin: string, userName = 'Admin'): Promise<boolean> {
    const settings = await this.getSettings();
    if (settings.security.super_admin_pin && settings.security.super_admin_pin !== adminPin) {
      throw new Error('Invalid Super Admin Security PIN. Reopen session rejected.');
    }

    if (isSupabaseConfigured) {
      try {
        const { data: existing } = await supabase
          .from('accounting_closings')
          .select('id')
          .eq('id', id)
          .maybeSingle();

        if (!existing) return false;

        await supabase
          .from('accounting_closings')
          .delete()
          .eq('id', id);
      } catch { }
    }

    const local = this.getLocalClosings();
    this.setLocalClosings(local.filter(c => c.id !== id));

    await this.logAudit({
      user_name: userName,
      action: 'REOPEN_ACCOUNTING_PERIOD',
      entity: `Reopened session ${id}`
    });

    return true;
  }

  static async adjustClosedSession(params: {
    closingId: string;
    adminPin: string;
    adjustmentType: 'EXPENSE' | 'TRANSFER' | 'BALANCES_ONLY';
    expense?: {
      title: string;
      amount: number;
      category: string;
      payment_mode: 'Cash' | 'UPI' | 'Split';
      cash_amount?: number;
      upi_amount?: number;
      notes?: string;
      created_at?: string;
    };
    transfer?: {
      direction: 'CASH_TO_UPI' | 'UPI_TO_CASH';
      amount: number;
      reason: string;
      reference_no?: string;
      notes?: string;
      created_at?: string;
    };
    overrideActualCash?: number;
    overrideActualUpi?: number;
    discrepancyNote?: string;
    userName?: string;
  }): Promise<{ updatedClosing: AccountingClosing; cascadedCount: number; cashDelta: number; upiDelta: number }> {
    const settings = await this.getSettings();
    if (settings.security.super_admin_pin && settings.security.super_admin_pin !== params.adminPin) {
      throw new Error('Invalid Super Admin Security PIN. Session adjustment rejected.');
    }

    const userName = params.userName || 'Admin';
    const allClosings = await this.getAccountingClosings();
    const target = allClosings.find(c => c.id === params.closingId);
    if (!target) {
      throw new Error('Target closed session could not be found.');
    }

    // Default timestamp to session cutoff time minus 1 second if not given
    const sessionToMs = new Date(target.to_date).getTime();
    const sessionFromMs = new Date(target.from_date).getTime();
    const defaultTimestamp = new Date(sessionToMs > 1000 ? sessionToMs - 1000 : sessionToMs).toISOString();

    // 1. Record retroactively added expense if selected
    if (params.adjustmentType === 'EXPENSE' && params.expense) {
      const expTs = params.expense.created_at || defaultTimestamp;
      const expMs = new Date(expTs).getTime();
      if (expMs < sessionFromMs || expMs > sessionToMs) {
        throw new Error(`Expense timestamp must fall within session period (${target.from_date.slice(0, 10)} to ${target.to_date.slice(0, 10)}).`);
      }
      await this.addExpense({
        ...params.expense,
        created_at: expTs,
        notes: [params.expense.notes, `[Audited into Session ${target.closing_number || 'CLOSED'}]`].filter(Boolean).join(' ')
      }, userName);
    }

    // 2. Record retroactively added internal transfer if selected
    if (params.adjustmentType === 'TRANSFER' && params.transfer) {
      const transTs = params.transfer.created_at || defaultTimestamp;
      const transMs = new Date(transTs).getTime();
      if (transMs < sessionFromMs || transMs > sessionToMs) {
        throw new Error(`Transfer timestamp must fall within session period (${target.from_date.slice(0, 10)} to ${target.to_date.slice(0, 10)}).`);
      }
      await this.createInternalTransfer({
        ...params.transfer,
        created_at: transTs,
        notes: [params.transfer.notes, `[Audited into Session ${target.closing_number || 'CLOSED'}]`].filter(Boolean).join(' ')
      }, userName);
    }

    // 3. Recalculate target session figures using the reconciliation engine
    const newCalc = await this.calculateReconciliationForRange(target.from_date, target.to_date);

    const deltaExpectedCash = Number((newCalc.expected_cash - target.expected_cash).toFixed(2));
    const deltaExpectedUpi = Number((newCalc.expected_upi - target.expected_upi).toFixed(2));

    // Determine new actual balances: auto-adjust if no explicit override provided
    const newActualCash = params.overrideActualCash !== undefined
      ? Number(params.overrideActualCash)
      : Number((target.actual_cash + deltaExpectedCash).toFixed(2));

    const newActualUpi = params.overrideActualUpi !== undefined
      ? Number(params.overrideActualUpi)
      : Number((target.actual_upi + deltaExpectedUpi).toFixed(2));

    const cashDelta = Number((newActualCash - target.actual_cash).toFixed(2));
    const upiDelta = Number((newActualUpi - target.actual_upi).toFixed(2));

    const actionSummary = params.adjustmentType === 'EXPENSE'
      ? `Added Expense ₹${params.expense?.amount} (${params.expense?.payment_mode})`
      : params.adjustmentType === 'TRANSFER'
      ? `Added Contra Transfer ₹${params.transfer?.amount} (${params.transfer?.direction})`
      : 'Balances & Counted Cash Adjusted';

    const auditEntry = `[${new Date().toLocaleString('en-IN')}] Audited by ${userName}: ${actionSummary}. Net delta: Cash ${cashDelta >= 0 ? '+' : ''}₹${cashDelta.toFixed(2)}, UPI ${upiDelta >= 0 ? '+' : ''}₹${upiDelta.toFixed(2)}`;

    const updatedTarget: AccountingClosing = {
      ...target,
      cash_inflow: newCalc.cash_inflow,
      upi_inflow: newCalc.upi_inflow,
      cash_outflow: newCalc.cash_outflow,
      upi_outflow: newCalc.upi_outflow,
      transfers_cash_to_upi: newCalc.transfers_cash_to_upi,
      transfers_upi_to_cash: newCalc.transfers_upi_to_cash,
      expected_cash: newCalc.expected_cash,
      expected_upi: newCalc.expected_upi,
      actual_cash: newActualCash,
      actual_upi: newActualUpi,
      cash_difference: Number((newActualCash - newCalc.expected_cash).toFixed(2)),
      upi_difference: Number((newActualUpi - newCalc.expected_upi).toFixed(2)),
      discrepancy_note: params.discrepancyNote ? params.discrepancyNote.trim() : target.discrepancy_note,
      last_audited_at: new Date().toISOString(),
      last_audited_by: userName,
      audit_notes: [target.audit_notes, auditEntry].filter(Boolean).join(' | ')
    };

    // 4. Update target session in Supabase & Local
    if (isSupabaseConfigured && this.hasAccountingClosingsTable !== false) {
      try {
        await supabase
          .from('accounting_closings')
          .update({
            cash_inflow: updatedTarget.cash_inflow,
            upi_inflow: updatedTarget.upi_inflow,
            cash_outflow: updatedTarget.cash_outflow,
            upi_outflow: updatedTarget.upi_outflow,
            transfers_cash_to_upi: updatedTarget.transfers_cash_to_upi,
            transfers_upi_to_cash: updatedTarget.transfers_upi_to_cash,
            expected_cash: updatedTarget.expected_cash,
            expected_upi: updatedTarget.expected_upi,
            actual_cash: updatedTarget.actual_cash,
            actual_upi: updatedTarget.actual_upi,
            cash_difference: updatedTarget.cash_difference,
            upi_difference: updatedTarget.upi_difference,
            discrepancy_note: updatedTarget.discrepancy_note,
            last_audited_at: updatedTarget.last_audited_at,
            last_audited_by: updatedTarget.last_audited_by,
            audit_notes: updatedTarget.audit_notes
          })
          .eq('id', target.id);
      } catch (err) {
        console.warn('Supabase update failed for target closing:', err);
      }
    }

    // 5. Cascade forward to all subsequent closed sessions
    const subsequent = allClosings
      .filter(c => c.id !== target.id && new Date(c.from_date).getTime() >= sessionToMs)
      .sort((a, b) => new Date(a.from_date).getTime() - new Date(b.from_date).getTime());

    for (const sub of subsequent) {
      const subCascadedAudit = `[${new Date().toLocaleString('en-IN')}] Cascaded from Session ${target.closing_number || 'CLOSED'}: Cash ${cashDelta >= 0 ? '+' : ''}₹${cashDelta.toFixed(2)}, UPI ${upiDelta >= 0 ? '+' : ''}₹${upiDelta.toFixed(2)}`;
      const newSubOpeningCash = Number((sub.opening_cash + cashDelta).toFixed(2));
      const newSubExpectedCash = Number((sub.expected_cash + cashDelta).toFixed(2));
      const newSubActualCash = Number((sub.actual_cash + cashDelta).toFixed(2));
      const newSubOpeningUpi = Number((sub.opening_upi + upiDelta).toFixed(2));
      const newSubExpectedUpi = Number((sub.expected_upi + upiDelta).toFixed(2));
      const newSubActualUpi = Number((sub.actual_upi + upiDelta).toFixed(2));

      sub.opening_cash = newSubOpeningCash;
      sub.expected_cash = newSubExpectedCash;
      sub.actual_cash = newSubActualCash;
      sub.opening_upi = newSubOpeningUpi;
      sub.expected_upi = newSubExpectedUpi;
      sub.actual_upi = newSubActualUpi;
      sub.last_audited_at = new Date().toISOString();
      sub.last_audited_by = userName;
      sub.audit_notes = [sub.audit_notes, subCascadedAudit].filter(Boolean).join(' | ');

      if (isSupabaseConfigured && this.hasAccountingClosingsTable !== false) {
        try {
          await supabase
            .from('accounting_closings')
            .update({
              opening_cash: newSubOpeningCash,
              expected_cash: newSubExpectedCash,
              actual_cash: newSubActualCash,
              opening_upi: newSubOpeningUpi,
              expected_upi: newSubExpectedUpi,
              actual_upi: newSubActualUpi,
              last_audited_at: sub.last_audited_at,
              last_audited_by: sub.last_audited_by,
              audit_notes: sub.audit_notes
            })
            .eq('id', sub.id);
        } catch (err) {
          console.warn(`Failed cascading to subsequent session ${sub.id}:`, err);
        }
      }
    }

    // 6. Update local storage records if used
    const local = this.getLocalClosings();
    if (local.length > 0) {
      const updatedLocal = local.map(c => {
        if (c.id === target.id) return updatedTarget;
        const subMatch = subsequent.find(s => s.id === c.id);
        if (subMatch) return subMatch;
        return c;
      });
      this.setLocalClosings(updatedLocal);
    }

    // 7. Audit log record
    await this.logAudit({
      user_name: userName,
      action: 'RETROACTIVE_SESSION_ADJUSTMENT',
      entity: `Session ${target.closing_number || target.id}`,
      new_value: JSON.stringify({
        adjustmentType: params.adjustmentType,
        actionSummary,
        cashDelta,
        upiDelta,
        cascadedSubsequentCount: subsequent.length
      })
    });

    return {
      updatedClosing: updatedTarget,
      cascadedCount: subsequent.length,
      cashDelta,
      upiDelta
    };
  }

  // =========================================================================
  // CURRENT ACTIVE SESSION & RECONCILIATION ENGINE
  // =========================================================================

  static async isDateInClosedSession(dateStr: string): Promise<{ isClosed: boolean; session?: AccountingClosing }> {
    const closings = await this.getAccountingClosings();
    const d = new Date(dateStr).getTime();
    for (const c of closings) {
      const from = new Date(c.from_date).getTime();
      const to = new Date(c.to_date).getTime();
      if (d >= from && d <= to) {
        return { isClosed: true, session: c };
      }
    }
    return { isClosed: false };
  }

  static async getCurrentSessionStatus(): Promise<CurrentSessionStatus> {
    const latestClosing = await this.getLatestAccountingClosing();
    const [allBills, allPayments, allExpenses, allTransfers, allCustomers] = await Promise.all([
      this.getBills(),
      this.getPayments(),
      this.getExpenses(),
      this.getInternalTransfers(),
      this.getCustomers()
    ]);

    let session_start_date = latestClosing?.to_date;
    if (!session_start_date) {
      const allTimestamps = [
        ...allBills.map(b => new Date(b.created_at).getTime()),
        ...allPayments.map(p => new Date(p.created_at).getTime()),
        ...allExpenses.map(e => new Date(e.created_at).getTime()),
        ...allTransfers.map(t => new Date(t.created_at).getTime())
      ].filter(t => !isNaN(t) && t > 0);

      if (allTimestamps.length > 0) {
        const minDate = new Date(Math.min(...allTimestamps));
        session_start_date = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate(), 0, 0, 0, 0).toISOString();
      } else {
        session_start_date = new Date().toISOString();
      }
    }

    const opening_cash = latestClosing ? Number(latestClosing.actual_cash !== undefined ? latestClosing.actual_cash : (latestClosing.expected_cash || 0)) : 0;
    const opening_upi = latestClosing ? Number(latestClosing.actual_upi !== undefined ? latestClosing.actual_upi : (latestClosing.expected_upi || 0)) : 0;

    const sessionStartMs = new Date(session_start_date).getTime();

    const bills = latestClosing
      ? allBills.filter(b => new Date(b.created_at).getTime() > sessionStartMs)
      : allBills;
    const payments = latestClosing
      ? allPayments.filter(p => new Date(p.created_at).getTime() > sessionStartMs && p.status !== 'CANCELLED' && p.status !== 'REVERSED')
      : allPayments.filter(p => p.status !== 'CANCELLED' && p.status !== 'REVERSED');
    const expenses = latestClosing
      ? allExpenses.filter(e => new Date(e.created_at).getTime() > sessionStartMs)
      : allExpenses;
    const transfers = latestClosing
      ? allTransfers.filter(t => new Date(t.created_at).getTime() > sessionStartMs)
      : allTransfers;

    let pending_dues_total = 0;
    let unpaid_bills_count = 0;
    allBills.forEach(b => {
      const grandTotal = Number(b.grand_total || 0);
      const paidTotal = Number(b.paid_total !== undefined ? b.paid_total : ((b.cash_paid || 0) + (b.upi_paid || 0) + (b.advance_used || 0)));
      const due = Math.max(0, Number((grandTotal - paidTotal).toFixed(2)));
      if (due > 0.01) {
        pending_dues_total += due;
        unpaid_bills_count++;
      }
    });

    const customer_advances_total = allCustomers.reduce((sum, c) => {
      return sum + Number(c.advance_balance || 0);
    }, 0);

    const current_sales = bills.reduce((sum, b) => sum + Number(b.grand_total || 0), 0);

    let current_cash_inflow = 0;
    let current_upi_inflow = 0;

    const billsById = new Map(allBills.map(b => [b.id, b]));
    const paymentBillIds = new Set(payments.map(p => p.bill_id).filter(Boolean));

    payments.forEach(p => {
      const amt = Number(p.amount || 0);
      if (p.payment_method === 'Cash') {
        current_cash_inflow += amt;
      } else if (p.payment_method === 'UPI') {
        current_upi_inflow += amt;
      } else if (p.payment_method === 'Split Payment') {
        const linked = p.bill_id ? billsById.get(p.bill_id) : undefined;
        if (linked && (Number(linked.cash_paid || 0) + Number(linked.upi_paid || 0) > 0)) {
          current_cash_inflow += Number(linked.cash_paid || 0);
          current_upi_inflow += Number(linked.upi_paid || 0);
        } else {
          current_cash_inflow += amt;
        }
      }
    });

    bills.forEach(b => {
      // Include direct cash/upi from any bill without a registered payment voucher
      if (!paymentBillIds.has(b.id)) {
        current_cash_inflow += Number(b.cash_paid || 0);
        current_upi_inflow += Number(b.upi_paid || 0);
      }
    });

    const current_cash_outflow = expenses.reduce((sum, e) => sum + Number(e.cash_amount !== undefined ? e.cash_amount : (e.payment_mode === 'Cash' ? e.amount : 0)), 0);
    const current_upi_outflow = expenses.reduce((sum, e) => sum + Number(e.upi_amount !== undefined ? e.upi_amount : (e.payment_mode === 'UPI' ? e.amount : 0)), 0);

    let current_transfers_cash_to_upi = 0;
    let current_transfers_upi_to_cash = 0;

    transfers.forEach(t => {
      const amt = Number(t.amount || 0);
      if (t.direction === 'CASH_TO_UPI') current_transfers_cash_to_upi += amt;
      else if (t.direction === 'UPI_TO_CASH') current_transfers_upi_to_cash += amt;
    });

    const expected_cash_in_hand = opening_cash + current_cash_inflow - current_cash_outflow - current_transfers_cash_to_upi + current_transfers_upi_to_cash;
    const expected_upi_in_hand = opening_upi + current_upi_inflow - current_upi_outflow + current_transfers_cash_to_upi - current_transfers_upi_to_cash;

    const opening_advance_pool = latestClosing && latestClosing.closing_advance_pool !== undefined
      ? Number(latestClosing.closing_advance_pool || 0)
      : 0;
    const current_advance_utilized = bills.reduce((sum, b) => sum + Number(b.advance_used || 0), 0);
    const current_advance_received = bills.reduce((sum, b) => sum + Number(b.advance_earned || 0), 0) +
      payments
        .filter(p => !p.bill_id && (p.notes?.toLowerCase().includes('advance') || p.payment_method?.toLowerCase().includes('advance')))
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return {
      last_closed_session: latestClosing,
      session_start_date,
      opening_cash: Number(opening_cash.toFixed(2)),
      opening_upi: Number(opening_upi.toFixed(2)),
      opening_advance_pool: Number(opening_advance_pool.toFixed(2)),
      current_sales: Number(current_sales.toFixed(2)),
      current_cash_inflow: Number(current_cash_inflow.toFixed(2)),
      current_upi_inflow: Number(current_upi_inflow.toFixed(2)),
      current_advance_received: Number(current_advance_received.toFixed(2)),
      current_advance_utilized: Number(current_advance_utilized.toFixed(2)),
      current_cash_outflow: Number(current_cash_outflow.toFixed(2)),
      current_upi_outflow: Number(current_upi_outflow.toFixed(2)),
      current_transfers_cash_to_upi: Number(current_transfers_cash_to_upi.toFixed(2)),
      current_transfers_upi_to_cash: Number(current_transfers_upi_to_cash.toFixed(2)),
      expected_cash_in_hand: Number(expected_cash_in_hand.toFixed(2)),
      expected_upi_in_hand: Number(expected_upi_in_hand.toFixed(2)),
      bills_count: bills.length,
      expenses_count: expenses.length,
      transfers_count: transfers.length,
      pending_dues_total: Number(pending_dues_total.toFixed(2)),
      unpaid_bills_count,
      customer_advances_total: Number(customer_advances_total.toFixed(2))
    };
  }

  static async calculateReconciliationForRange(fromDate: string, toDate: string): Promise<ReconciliationCalculation> {
    const fromMs = new Date(fromDate).getTime();
    const toMs = new Date(toDate).getTime();

    const closings = await this.getAccountingClosings();
    // Prior closing ending at or before fromDate
    const priorClosing = closings.find(c => new Date(c.to_date).getTime() <= fromMs);
    const opening_cash = priorClosing ? Number(priorClosing.actual_cash !== undefined ? priorClosing.actual_cash : (priorClosing.expected_cash || 0)) : 0;
    const opening_upi = priorClosing ? Number(priorClosing.actual_upi !== undefined ? priorClosing.actual_upi : (priorClosing.expected_upi || 0)) : 0;
    const isExactPriorBoundary = priorClosing ? new Date(priorClosing.to_date).getTime() === fromMs : false;

    const [allBills, allPayments, allExpenses, allTransfers, allCustomers] = await Promise.all([
      this.getBills(),
      this.getPayments(),
      this.getExpenses(),
      this.getInternalTransfers(),
      this.getCustomers()
    ]);

    const inRange = (ms: number) => isExactPriorBoundary ? (ms > fromMs && ms <= toMs) : (ms >= fromMs && ms <= toMs);

    const rangeBills = allBills.filter(b => inRange(new Date(b.created_at).getTime()));
    const rangePayments = allPayments.filter(p => inRange(new Date(p.created_at).getTime()) && p.status !== 'CANCELLED' && p.status !== 'REVERSED');
    const rangeExpenses = allExpenses.filter(e => inRange(new Date(e.created_at).getTime()));
    const rangeTransfers = allTransfers.filter(t => inRange(new Date(t.created_at).getTime()));

    const total_sales = rangeBills.reduce((s, b) => s + Number(b.grand_total || 0), 0);

    let cash_inflow = 0;
    let upi_inflow = 0;

    const billsById = new Map(allBills.map(b => [b.id, b]));
    const paymentBillIds = new Set(rangePayments.map(p => p.bill_id).filter(Boolean));

    rangePayments.forEach(p => {
      const amt = Number(p.amount || 0);
      if (p.payment_method === 'Cash') {
        cash_inflow += amt;
      } else if (p.payment_method === 'UPI') {
        upi_inflow += amt;
      } else if (p.payment_method === 'Split Payment') {
        const linked = p.bill_id ? billsById.get(p.bill_id) : undefined;
        if (linked && (Number(linked.cash_paid || 0) + Number(linked.upi_paid || 0) > 0)) {
          cash_inflow += Number(linked.cash_paid || 0);
          upi_inflow += Number(linked.upi_paid || 0);
        } else {
          cash_inflow += amt;
        }
      }
    });

    rangeBills.forEach(b => {
      // Include direct cash/upi from any bill without a registered payment voucher
      if (!paymentBillIds.has(b.id)) {
        cash_inflow += Number(b.cash_paid || 0);
        upi_inflow += Number(b.upi_paid || 0);
      }
    });

    const cash_outflow = rangeExpenses.reduce((s, e) => s + Number(e.cash_amount !== undefined ? e.cash_amount : (e.payment_mode === 'Cash' ? e.amount : 0)), 0);
    const upi_outflow = rangeExpenses.reduce((s, e) => s + Number(e.upi_amount !== undefined ? e.upi_amount : (e.payment_mode === 'UPI' ? e.amount : 0)), 0);

    let transfers_cash_to_upi = 0;
    let transfers_upi_to_cash = 0;

    rangeTransfers.forEach(t => {
      const amt = Number(t.amount || 0);
      if (t.direction === 'CASH_TO_UPI') transfers_cash_to_upi += amt;
      else if (t.direction === 'UPI_TO_CASH') transfers_upi_to_cash += amt;
    });

    const expected_cash = opening_cash + cash_inflow - cash_outflow - transfers_cash_to_upi + transfers_upi_to_cash;
    const expected_upi = opening_upi + upi_inflow - upi_outflow + transfers_cash_to_upi - transfers_upi_to_cash;

    // Scan for all pending dues on bills created in this session
    const customersById = new Map(allCustomers.map(c => [c.id, c]));
    const unpaid_bills: UnpaidSessionBill[] = [];
    let pending_session_dues = 0;

    rangeBills.forEach(b => {
      const grandTotal = Number(b.grand_total || 0);
      const paidTotal = Number(b.paid_total !== undefined ? b.paid_total : ((b.cash_paid || 0) + (b.upi_paid || 0) + (b.advance_used || 0)));
      const due = Math.max(0, Number((grandTotal - paidTotal).toFixed(2)));
      if (due > 0.01) {
        pending_session_dues += due;
        const cust = b.customer_id ? customersById.get(b.customer_id) : undefined;
        unpaid_bills.push({
          id: b.id,
          bill_number: b.bill_number,
          customer_id: b.customer_id,
          customer_name: b.customer_name || cust?.name || 'Counter Customer',
          customer_mobile: b.customer_mobile || cust?.mobile,
          grand_total: grandTotal,
          paid_total: paidTotal,
          due_amount: due,
          customer_advance: Number(cust?.advance_balance || 0),
          created_at: b.created_at
        });
      }
    });

    const totalCurrentCustomerAdvance = allCustomers.reduce((sum, c) => sum + Number(c.advance_balance || 0), 0);
    const opening_advance_pool = priorClosing && priorClosing.closing_advance_pool !== undefined
      ? Number(priorClosing.closing_advance_pool || 0)
      : 0;

    const advance_utilized = rangeBills.reduce((s, b) => s + Number(b.advance_used || 0), 0);
    const advance_received = rangeBills.reduce((s, b) => s + Number(b.advance_earned || 0), 0) +
      rangePayments
        .filter(p => !p.bill_id && (p.notes?.toLowerCase().includes('advance') || p.payment_method?.toLowerCase().includes('advance')))
        .reduce((s, p) => s + Number(p.amount || 0), 0);

    const closing_advance_pool = totalCurrentCustomerAdvance;

    return {
      from_date: fromDate,
      to_date: toDate,
      opening_cash: Number(opening_cash.toFixed(2)),
      opening_upi: Number(opening_upi.toFixed(2)),
      opening_advance_pool: Number(opening_advance_pool.toFixed(2)),
      cash_inflow: Number(cash_inflow.toFixed(2)),
      upi_inflow: Number(upi_inflow.toFixed(2)),
      advance_received: Number(advance_received.toFixed(2)),
      advance_utilized: Number(advance_utilized.toFixed(2)),
      closing_advance_pool: Number(closing_advance_pool.toFixed(2)),
      cash_outflow: Number(cash_outflow.toFixed(2)),
      upi_outflow: Number(upi_outflow.toFixed(2)),
      transfers_cash_to_upi: Number(transfers_cash_to_upi.toFixed(2)),
      transfers_upi_to_cash: Number(transfers_upi_to_cash.toFixed(2)),
      expected_cash: Number(expected_cash.toFixed(2)),
      expected_upi: Number(expected_upi.toFixed(2)),
      bills_count: rangeBills.length,
      expenses_count: rangeExpenses.length,
      transfers_count: rangeTransfers.length,
      total_sales: Number(total_sales.toFixed(2)),
      pending_session_dues: Number(pending_session_dues.toFixed(2)),
      unpaid_bills
    };
  }
}


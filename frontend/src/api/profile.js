import { supabase, logSupabaseError } from '../lib/supabase'

export const getProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('business_profile')
    .select('*')
    .eq('user_id', user?.id)
    .single();
  if (error) {
    logSupabaseError('business_profile', 'SELECT_ONE', { user_id: user?.id }, error);
    throw error;
  }
  return { data: { data } };
}

export const updateProfile = async (data) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  const profileData = {};
  if (data.shop_name !== undefined) profileData.shop_name = data.shop_name;
  if (data.owner_name !== undefined) profileData.owner_name = data.owner_name;
  if (data.phone !== undefined) profileData.phone = data.phone;
  if (data.address !== undefined) profileData.address = data.address;
  if (data.gstin !== undefined) profileData.gstin = data.gstin;
  if (data.upi_id !== undefined) profileData.upi_id = data.upi_id;
  if (data.settings !== undefined) profileData.settings = data.settings;
  if (data.id_counters !== undefined) profileData.id_counters = data.id_counters;
  if (data.advance_payments !== undefined) profileData.advance_payments = data.advance_payments;
  if (data.recurring_bills !== undefined) profileData.recurring_bills = data.recurring_bills;
  if (data.customer_groups !== undefined) profileData.customer_groups = data.customer_groups;
  if (data.group_bills !== undefined) profileData.group_bills = data.group_bills;
  if (data.deleted_payments !== undefined) profileData.deleted_payments = data.deleted_payments;
  
  const { data: updated, error } = await supabase
    .from('business_profile')
    .update(profileData)
    .eq('user_id', user?.id)
    .select()
    .single();
    
  if (error) {
    logSupabaseError('business_profile', 'UPDATE', { user_id: user?.id, profileData }, error);
    throw error;
  }
  return { data: { data: updated } };
}

export const clearUserData = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  
  try {
    await Promise.all([
      supabase.from('bill_items').delete().eq('user_id', userId),
      supabase.from('payments').delete().eq('user_id', userId),
      supabase.from('bills').delete().eq('user_id', userId),
      supabase.from('customers').delete().eq('user_id', userId),
      supabase.from('inventory_items').delete().eq('user_id', userId),
      supabase.from('purchases').delete().eq('user_id', userId),
      supabase.from('audit_log').delete().eq('user_id', userId),
      supabase.from('business_profile').update({
        settings: {},
        id_counters: {},
        advance_payments: [],
        recurring_bills: [],
        customer_groups: [],
        group_bills: [],
        deleted_payments: []
      }).eq('user_id', userId)
    ]);
  } catch (error) {
    logSupabaseError('multiple_tables', 'CLEAR_ALL_USER_DATA', { user_id: userId }, error);
    throw error;
  }
  
  return { data: { success: true } };
}

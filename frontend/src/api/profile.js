import { supabase, logSupabaseError } from '../lib/supabase'

export const getProfile = async () => {
  try {
    const { data, error } = await supabase
      .from('business_profile')
      .select('*')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      logSupabaseError('business_profile', 'SELECT_ONE', {}, error);
      throw error;
    }

    if (data) {
      return { data: { data } };
    }

    // Auto-provision a default empty profile row if none exists
    const defaultProfile = {
      shop_name: '',
      owner_name: '',
      phone: '',
      address: '',
      gstin: '',
      upi_id: '',
    };

    const { data: inserted, error: insertError } = await supabase
      .from('business_profile')
      .insert(defaultProfile)
      .select()
      .maybeSingle();

    if (insertError) {
      // If insert failed (e.g. race condition), retry the select once
      const { data: retryData, error: retryError } = await supabase
        .from('business_profile')
        .select('*')
        .maybeSingle();

      if (retryError && retryError.code !== 'PGRST116') {
        logSupabaseError('business_profile', 'SELECT_RETRY', {}, retryError);
      }

      return { data: { data: retryData || defaultProfile } };
    }

    return { data: { data: inserted || defaultProfile } };
  } catch (error) {
    if (error?.code === 'PGRST116') {
      return { data: { data: {} } };
    }
    logSupabaseError('business_profile', 'SELECT_ONE', {}, error);
    throw error;
  }
}

export const updateProfile = async (data) => {
  try {
    const { data: updated, error } = await supabase
      .from('business_profile')
      .update(data)
      .select()
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      logSupabaseError('business_profile', 'UPDATE', data, error);
      throw error;
    }

    if (updated) {
      return { data: { data: updated } };
    }

    // If no row was updated (row missing), upsert/insert
    const { data: upserted, error: upsertError } = await supabase
      .from('business_profile')
      .upsert(data)
      .select()
      .maybeSingle();

    if (upsertError && upsertError.code !== 'PGRST116') {
      logSupabaseError('business_profile', 'UPSERT', data, upsertError);
      throw upsertError;
    }

    return { data: { data: upserted || data || {} } };
  } catch (error) {
    if (error?.code === 'PGRST116') {
      return { data: { data: data || {} } };
    }
    throw error;
  }
}

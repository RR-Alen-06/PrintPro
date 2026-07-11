import { supabase, logSupabaseError } from '../lib/supabase'

export const getProfile = async () => {
  const { data, error } = await supabase
    .from('business_profile')
    .select('*')
    .single();

  if (error) {
    logSupabaseError('business_profile', 'SELECT_ONE', {}, error);
    throw error;
  }
  return { data: { data } };
}

export const updateProfile = async (data) => {
  const { data: updated, error } = await supabase
    .from('business_profile')
    .update(data)
    .select()
    .single();

  if (error) {
    logSupabaseError('business_profile', 'UPDATE', data, error);
    throw error;
  }
  return { data: { data: updated } };
}

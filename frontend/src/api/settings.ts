import api from './index'
import { supabase } from '../lib/supabase'

export const getSettings = async () => {
  try {
    const res = await api.get('/settings')
    return { data: { data: res.data?.data || {} } }
  } catch (err) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: { data: {} } }
    const { data, error } = await supabase
      .from('business_profile')
      .select('settings')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error && (error as any).code !== 'PGRST116') throw error
    const settings = (data && data.settings) || {}
    return { data: { data: settings } }
  }
}

export const updateSettings = async (settingsData: any) => {
  try {
    const res = await api.put('/settings', { settings: settingsData })
    return { data: { data: res.data?.data || settingsData } }
  } catch (err) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw err
    const { data: existing } = await supabase
      .from('business_profile')
      .select('settings')
      .eq('user_id', user.id)
      .maybeSingle()
    const current = (existing && existing.settings) || {}
    const merged = typeof current === 'object' && !Array.isArray(current)
      ? { ...current, ...settingsData }
      : settingsData
    const { data, error } = await supabase
      .from('business_profile')
      .update({ settings: merged })
      .eq('user_id', user.id)
      .select('settings')
      .single()
    if (error) throw error
    return { data: { data: data?.settings || merged } }
  }
}

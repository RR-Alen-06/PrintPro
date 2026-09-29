import api from './index'
import { supabase } from '../lib/supabase'

export interface PromoCodeDto {
  id?: string
  code: string
  type: 'percent' | 'flat'
  value: number
  minAmount?: number
  min_amount?: number
  maxDiscount?: number | null
  max_discount?: number | null
  startDate?: string | null
  start_date?: string | null
  endDate?: string | null
  end_date?: string | null
  enabled?: boolean
  createdAt?: string
  updatedAt?: string
}

export const mapPromoCodeFromApi = (p: any): PromoCodeDto => ({
  id: p.id,
  code: (p.code || '').trim().toUpperCase(),
  type: p.type || 'percent',
  value: Number(p.value || 0),
  minAmount: p.minAmount !== undefined ? Number(p.minAmount) : (p.min_amount != null ? Number(p.min_amount) : 0),
  maxDiscount: p.maxDiscount !== undefined ? (p.maxDiscount === '' || p.maxDiscount === null ? null : Number(p.maxDiscount)) : (p.max_discount != null ? Number(p.max_discount) : null),
  startDate: p.startDate || p.start_date || null,
  endDate: p.endDate || p.end_date || null,
  enabled: p.enabled !== false,
  createdAt: p.createdAt || p.created_at,
  updatedAt: p.updatedAt || p.updated_at,
})

export const getPromoCodes = async () => {
  try {
    const res = await api.get('/promo-codes')
    const mapped = (res.data?.data || []).map(mapPromoCodeFromApi)
    return { data: { data: mapped } }
  } catch (err) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: { data: [] } }
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return { data: { data: (data || []).map(mapPromoCodeFromApi) } }
  }
}

export const createPromoCode = async (payload: PromoCodeDto) => {
  try {
    const res = await api.post('/promo-codes', payload)
    return { data: { data: mapPromoCodeFromApi(res.data?.data) } }
  } catch (err) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw err
    const { data, error } = await supabase
      .from('promo_codes')
      .insert({
        user_id: user.id,
        code: (payload.code || '').trim().toUpperCase(),
        type: payload.type || 'percent',
        value: Number(payload.value || 0),
        min_amount: payload.minAmount ?? 0,
        max_discount: payload.maxDiscount ?? null,
        start_date: payload.startDate ?? null,
        end_date: payload.endDate ?? null,
        enabled: payload.enabled !== false,
      })
      .select()
      .single()
    if (error) throw error
    return { data: { data: mapPromoCodeFromApi(data) } }
  }
}

export const updatePromoCode = async (id: string, payload: Partial<PromoCodeDto>) => {
  try {
    const res = await api.put(`/promo-codes/${id}`, payload)
    return { data: { data: mapPromoCodeFromApi(res.data?.data) } }
  } catch (err) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw err
    const updates: any = {}
    if (payload.code !== undefined) updates.code = payload.code.trim().toUpperCase()
    if (payload.type !== undefined) updates.type = payload.type
    if (payload.value !== undefined) updates.value = Number(payload.value)
    if (payload.minAmount !== undefined) updates.min_amount = Number(payload.minAmount)
    if (payload.maxDiscount !== undefined) updates.max_discount = payload.maxDiscount
    if (payload.startDate !== undefined) updates.start_date = payload.startDate
    if (payload.endDate !== undefined) updates.end_date = payload.endDate
    if (payload.enabled !== undefined) updates.enabled = payload.enabled
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('promo_codes')
      .update(updates)
      .eq('user_id', user.id)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return { data: { data: mapPromoCodeFromApi(data) } }
  }
}

export const deletePromoCode = async (id: string) => {
  try {
    const res = await api.delete(`/promo-codes/${id}`)
    return res.data
  } catch (err) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw err
    const { error } = await supabase
      .from('promo_codes')
      .delete()
      .eq('user_id', user.id)
      .eq('id', id)
    if (error) throw error
    return { success: true }
  }
}

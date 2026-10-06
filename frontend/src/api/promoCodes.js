import api from './index'

export const getPromoCodes = () => api.get('/promo-codes')

export const createPromoCode = (data) => api.post('/promo-codes', data)

export const updatePromoCode = (id, data) => api.put(`/promo-codes/${id}`, data)

export const deletePromoCode = (id) => api.delete(`/promo-codes/${id}`)

export const bulkGeneratePromoCodes = (data) => api.post('/promo-codes/bulk-generate', data)

export const validatePromoCode = (data) => api.post('/promo-codes/validate', data)

export const trackPromoUse = (data) => api.post('/promo-codes/use', data)

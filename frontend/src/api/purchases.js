import api from './index'

export const getPurchases = (filters = {}) => {
  const params = {}
  if (filters.startDate) params.startDate = filters.startDate
  if (filters.endDate) params.endDate = filters.endDate
  if (filters.category) params.category = filters.category
  return api.get('/purchases', { params })
}

export const createPurchase = (data) => api.post('/purchases', data)

export const updatePurchase = (id, data) => api.put(`/purchases/${id}`, data)

export const deletePurchase = (id) => api.delete(`/purchases/${id}`)

export const getPurchaseSummary = () => api.get('/purchases/summary')

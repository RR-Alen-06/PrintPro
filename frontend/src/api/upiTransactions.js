import api from './index'

export const getUpiTransactions = (params = {}) => api.get('/upi-transactions', { params })
export const getUpiSummary = (params = {}) => api.get('/upi-transactions/summary', { params })
export const getDailyUpiSettlement = (date = '') => api.get('/upi-transactions/daily-settlement', { params: date ? { date } : {} })
export const createUpiTransaction = (data) => api.post('/upi-transactions', data)
export const updateUpiTransaction = (id, data) => api.put(`/upi-transactions/${id}`, data)
export const bulkConfirmUpi = (ids, status = 'confirmed') => api.post('/upi-transactions/bulk-confirm', { ids, status })

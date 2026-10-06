import api from './index'

export const getAdvancePayments = (customerId = '') => api.get('/advance-payments', { params: customerId ? { customer_id: customerId } : {} })
export const createAdvancePayment = (data) => api.post('/advance-payments', data)
export const updateAdvancePayment = (id, data) => api.put(`/advance-payments/${id}`, data)
export const deleteAdvancePayment = (id) => api.delete(`/advance-payments/${id}`)


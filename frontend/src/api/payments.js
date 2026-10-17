import api from './index'

export const getBillPayments = (billId) => api.get(`/bills/${encodeURIComponent(billId)}/payments`)

export const createPayment = (data) => api.post('/payments', data)

export const createRefund = (data) => api.post('/payments/refund', data)

export const getDeletedPayments = () => api.get('/payments/deleted')

export const getRefundPayments = (params = {}) => api.get('/payments/refunds', { params })

export const getCustomerPayments = (customerId) => api.get(`/customers/${encodeURIComponent(customerId)}/payments`)

export const getPayments = () => api.get('/payments')

export const deletePayment = (id) => api.delete(`/payments/${encodeURIComponent(id)}`)

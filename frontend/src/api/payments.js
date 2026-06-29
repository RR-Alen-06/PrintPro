import api from './index'

export const getBillPayments = (billId) => api.get(`/bills/${billId}/payments`)

export const createPayment = (data) => api.post('/payments', data)

export const getCustomerPayments = (customerId) => api.get(`/customers/${customerId}/payments`)

export const getPayments = () => api.get('/payments')

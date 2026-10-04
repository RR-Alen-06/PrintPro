import api from './index'

export const getCustomers = (type = 'all', search = '') => {
  const params = {}
  if (type && type !== 'all') params.type = type
  if (search) params.search = search
  return api.get('/customers', { params })
}

export const getCustomer = (id) => api.get(`/customers/${id}`)

export const createCustomer = (data) => api.post('/customers', data)

export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data)

export const deleteCustomer = (id) => api.delete(`/customers/${id}`)

export const getCustomerBills = (id) => api.get(`/customers/${id}/bills`)

export const getCustomerPayments = (id) => api.get(`/customers/${id}/payments`)

export const getCustomerStatement = (id) => api.get(`/customers/${id}/statement`)

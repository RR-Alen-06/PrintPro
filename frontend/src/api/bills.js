import api from './index'

export const getBills = (filters = {}) => {
  const params = {}
  if (filters.status) params.status = filters.status
  if (filters.startDate) params.startDate = filters.startDate
  if (filters.endDate) params.endDate = filters.endDate
  if (filters.customer) params.customer = filters.customer
  return api.get('/bills', { params })
}

export const getBill = (id) => api.get(`/bills/${id}`)

export const createBill = (data) => api.post('/bills', data)

export const updateBill = (id, data) => api.put(`/bills/${id}`, data)

export const deleteBill = (id) => api.delete(`/bills/${id}`)

export const restoreBill = (id) => api.post(`/bills/${id}/restore`)

export const getDeletedBills = () => api.get('/bills/deleted/all')

export const applyDiscount = (id, discountData) => api.post(`/bills/${id}/discount`, discountData)

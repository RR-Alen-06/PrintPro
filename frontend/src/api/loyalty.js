import api from './index'

export const getLoyaltySettings = () => api.get('/loyalty/settings')

export const updateLoyaltySettings = (data) => api.put('/loyalty/settings', data)

export const getCustomerLoyalty = (customerId) => api.get(`/loyalty/customer/${customerId}`)

export const adjustCustomerLoyalty = (customerId, data) => api.post(`/loyalty/customer/${customerId}/adjust`, data)

export const deleteLoyaltyEvent = (eventId) => api.delete(`/loyalty/events/${eventId}`)

export const earnLoyaltyPoints = (data) => api.post('/loyalty/earn', data)

export const redeemLoyaltyPoints = (data) => api.post('/loyalty/redeem', data)

export const getLoyaltyEvents = (customerId = '') =>
  api.get('/loyalty/events', { params: customerId ? { customer_id: customerId } : {} })

export const createLoyaltyEvent = (data) => api.post('/loyalty/events', data)

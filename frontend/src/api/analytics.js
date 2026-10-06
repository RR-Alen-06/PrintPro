import api from './index'

export const getProductAnalytics = (params = {}) => api.get('/analytics/products', { params })
export const getProductCustomerBreakdown = (itemName, params = {}) => api.get(`/analytics/products/${encodeURIComponent(itemName)}/customers`, { params })
export const getProductTrends = (params = {}) => api.get('/analytics/products/trends', { params })
export const getAnalyticsSummary = (params = {}) => api.get('/analytics/summary', { params })
export const getPromoUsageAnalytics = (params = {}) => api.get('/analytics/promo-usage', { params })
export const getExpensesByVendor = (params = {}) => api.get('/analytics/expenses/vendors', { params })
export const getExpensesByCategory = (params = {}) => api.get('/analytics/expenses/categories', { params })


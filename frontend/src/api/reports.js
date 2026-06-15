import api from './index'

export const getDailyReport = (date) => api.get('/reports/daily', { params: { date } })

export const getMonthlyReport = (year, month) => api.get('/reports/monthly', { params: { year, month } })

export const getYearlyReport = (year) => api.get('/reports/yearly', { params: { year } })

export const getReceivables = () => api.get('/reports/receivables')

export const getTopCustomers = (period) => api.get('/reports/top-customers', { params: { period } })

export const getBestItems = (period) => api.get('/reports/best-items', { params: { period } })

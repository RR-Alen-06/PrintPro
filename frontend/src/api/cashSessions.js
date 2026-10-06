import api from './index'

export const getCashSessions = () => api.get('/cash-sessions')
export const getActiveSession = () => api.get('/cash-sessions/active')
export const openCashSession = (data) => api.post('/cash-sessions/open', data)
export const closeCashSession = (id, data) => api.post(`/cash-sessions/${id}/close`, data)
export const getSessionReport = (id) => api.get(`/cash-sessions/${id}/report`)

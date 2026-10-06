import api from './index'

export const getNotifications = () => api.get('/notifications')

export const getOverdueNotifications = () => api.get('/notifications/overdue')


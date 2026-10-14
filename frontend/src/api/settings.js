import api from './index'

export const getSettings = () => api.get('/settings')
export const updateSettings = (settings) => api.put('/settings', { settings })
export const clearAllDataApi = () => api.delete('/settings/clear-all-data')


import api from './index'

export const getCustomerGroups = () => api.get('/customer-groups')
export const createCustomerGroup = (data) => api.post('/customer-groups', data)
export const updateCustomerGroup = (id, data) => api.put(`/customer-groups/${id}`, data)
export const deleteCustomerGroup = (id) => api.delete(`/customer-groups/${id}`)
export const getGroupBillsByGroup = (groupId) => api.get(`/customer-groups/${groupId}/bills`)
export const createGroupBillForGroup = (groupId, data) => api.post(`/customer-groups/${groupId}/bills`, data)

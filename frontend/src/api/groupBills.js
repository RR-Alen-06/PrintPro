import api from './index'

export const getGroupBills = () => api.get('/group-bills')
export const createGroupBill = (data) => api.post('/group-bills', data)
export const updateGroupBill = (id, data) => api.put(`/group-bills/${id}`, data)
export const deleteGroupBill = (id) => api.delete(`/group-bills/${id}`)
export const payGroupMember = (id, data) => api.post(`/group-bills/${id}/pay-member`, data)

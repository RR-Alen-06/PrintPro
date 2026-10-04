import api from './index'

export const getItems = () => api.get('/inventory')

export const createItem = (data) => api.post('/inventory', data)

export const updateItem = (id, data) => api.put(`/inventory/${id}`, data)

export const deleteItem = (id) => api.delete(`/inventory/${id}`)

export const getLowStock = () => api.get('/inventory/low-stock')

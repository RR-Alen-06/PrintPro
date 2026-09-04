import api from './index'

export const mapGroupBillFromApi = (gb: any) => ({
  id: gb.id,
  type: gb.type || 'shared',
  date: gb.date ? new Date(gb.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  dueDate: gb.due_date ? new Date(gb.due_date).toISOString().slice(0, 10) : null,
  notes: gb.notes || '',
  memberBillIds: gb.member_bill_ids || gb.memberBillIds || [],
  members: typeof gb.members === 'string' ? JSON.parse(gb.members || '[]') : (gb.members || []),
  createdAt: gb.created_at || gb.createdAt || new Date().toISOString(),
})

export const getGroupBills = async () => {
  const res = await api.get('/group-bills');
  const mapped = (res.data.data || []).map(mapGroupBillFromApi);
  return { data: { data: mapped } };
}

export const createGroupBill = async (data: any) => {
  const res = await api.post('/group-bills', data);
  return { data: { data: mapGroupBillFromApi(res.data.data) } };
}

export const updateGroupBill = async (id: string, data: any) => {
  const res = await api.put(`/group-bills/${id}`, data);
  return { data: { data: mapGroupBillFromApi(res.data.data) } };
}

export const deleteGroupBill = async (id: string) => {
  const res = await api.delete(`/group-bills/${id}`);
  return res.data;
}

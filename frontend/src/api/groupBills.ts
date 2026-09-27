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

export const mapGroupSettlementFromApi = (gs: any) => ({
  id: gs.id,
  groupBillId: gs.group_bill_id || gs.groupBillId,
  payerCustomerId: gs.payer_customer_id || gs.payerCustomerId,
  payerBillId: gs.payer_bill_id || gs.payerBillId,
  payerName: gs.payer_name || gs.payerName,
  cashAmount: Number(gs.cash_amount !== undefined ? gs.cash_amount : (gs.cashAmount || 0)),
  upiAmount: Number(gs.upi_amount !== undefined ? gs.upi_amount : (gs.upiAmount || 0)),
  totalPaid: Number(gs.total_paid !== undefined ? gs.total_paid : (gs.totalPaid || 0)),
  excessCredit: Number(gs.excess_credit !== undefined ? gs.excess_credit : (gs.excessCredit || 0)),
  settlements: typeof gs.settlements === 'string' ? JSON.parse(gs.settlements || '[]') : (gs.settlements || []),
  notes: gs.notes || '',
  date: gs.date || gs.created_at || new Date().toISOString(),
  createdAt: gs.created_at || new Date().toISOString(),
})

export const settleGroupBill = async (data: any) => {
  const payload = {
    group_bill_id: data.group_bill_id || data.groupBillId,
    payer_customer_id: data.payer_customer_id || data.payerCustomerId,
    payer_bill_id: data.payer_bill_id || data.payerBillId || null,
    cash_amount: Number(data.cash_amount !== undefined ? data.cash_amount : (data.cashAmount || 0)),
    upi_amount: Number(data.upi_amount !== undefined ? data.upi_amount : (data.upiAmount || 0)),
    total_paid: Number(data.total_paid !== undefined ? data.total_paid : (data.totalPaid || 0)),
    notes: data.notes || '',
  }
  const res = await api.post('/payments/group-settle', payload);
  return { data: { data: mapGroupSettlementFromApi(res.data.data) } };
}

export const getGroupSettlements = async (groupBillId?: string) => {
  const url = groupBillId ? `/payments/group-settlements?group_bill_id=${groupBillId}` : '/payments/group-settlements';
  const res = await api.get(url);
  const mapped = (res.data.data || []).map(mapGroupSettlementFromApi);
  return { data: { data: mapped } };
}

export const reverseGroupSettlement = async (id: string) => {
  const res = await api.delete(`/payments/group-settle/${id}`);
  return res.data;
}


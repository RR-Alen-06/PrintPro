import api from './index';

/**
 * Fetch customer ledger statement (JSON).
 * @param {string} customerId
 * @param {Object} params - { startDate, endDate }
 */
export async function getCustomerLedgerStatement(customerId, params = {}) {
  const query = new URLSearchParams();
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  
  const queryString = query.toString() ? `?${query.toString()}` : '';
  const response = await api.get(`/ledger/${customerId}${queryString}`);
  return response.data;
}

/**
 * Generate server-side PDF customer ledger statement and get shareable link.
 * @param {string} customerId
 * @param {Object} data - { startDate, endDate }
 */
export async function exportCustomerLedgerPdf(customerId, data = {}) {
  const response = await api.post(`/ledger/${customerId}/pdf`, data);
  return response.data;
}

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Edit3, FileText } from 'lucide-react';
import { apiRequest } from '../api/apiClient';
import type { Invoice } from './Billing';
import type { Customer } from './Customers';

export default function CustomerBills({ customerId, onBack }: { customerId?: string, onBack?: () => void }) {
  const queryClient = useQueryClient();
  const [selectedCustomer, setSelectedCustomer] = useState<string>(customerId || '');

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiRequest<Customer[]>('/customers'),
  });

  const { data: bills, isLoading } = useQuery({
    queryKey: ['customerBills', selectedCustomer],
    queryFn: () => apiRequest<Invoice[]>(`/billing/customer/${selectedCustomer}/bills`),
    enabled: !!selectedCustomer,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/billing/invoices/${id}/delete`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customerBills'] });
      queryClient.invalidateQueries({ queryKey: ['billsSearch'] });
      alert('Bill soft-deleted successfully');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete bill');
    }
  });

  return (
    <div className="p-8 animate-fadeIn">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <FileText className="text-indigo-500" />
            Customer Billing History
          </h1>
          <p className="text-gray-400 mt-2">View and manage past invoices for a customer.</p>
        </div>
        {onBack && (
          <button onClick={onBack} className="text-indigo-400 hover:text-indigo-300">
            &larr; Back
          </button>
        )}
      </div>

      {!customerId && (
        <div className="mb-6 max-w-md">
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">Select Customer</label>
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">-- Choose a customer --</option>
            {customers?.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {selectedCustomer && (
        <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-12 text-center text-gray-500">Loading bills...</div>
            ) : bills && bills.length > 0 ? (
              <table className="w-full text-left text-sm text-gray-300">
                <thead>
                  <tr className="border-b border-gray-800/80 text-gray-500 uppercase text-xs tracking-wider">
                    <th className="p-6">Bill No</th>
                    <th className="p-6">Date</th>
                    <th className="p-6">Subtotal</th>
                    <th className="p-6">Discount</th>
                    <th className="p-6">Total</th>
                    <th className="p-6">Status</th>
                    <th className="p-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {bills.map((bill) => (
                    <tr key={bill._id} className="hover:bg-gray-900/30 transition-all">
                      <td className="p-6 font-bold text-white">{bill.billNo}</td>
                      <td className="p-6">{bill.date}</td>
                      <td className="p-6 font-semibold">₹{bill.subtotal.toFixed(2)}</td>
                      <td className="p-6 text-red-400">₹{bill.discountAmount.toFixed(2)}</td>
                      <td className="p-6 font-bold text-white">₹{bill.total.toFixed(2)}</td>
                      <td className="p-6">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-semibold uppercase rounded-full ${
                          bill.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                          bill.status === 'partial' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-red-500/10 text-red-400'
                        }`}>
                          {bill.status}
                        </span>
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex justify-end gap-2.5">
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to soft delete ${bill.billNo}?`)) {
                                deleteMutation.mutate(bill._id);
                              }
                            }}
                            className="p-2 bg-gray-900 hover:bg-red-500/15 hover:text-red-400 border border-gray-800 rounded-lg transition-all cursor-pointer"
                            title="Soft Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-gray-500">
                No bills found for this customer.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

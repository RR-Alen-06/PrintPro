
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../api/apiClient';
import type { Invoice } from './Billing';

export default function DeletedBills() {
  const queryClient = useQueryClient();

  const { data: bills, isLoading } = useQuery({
    queryKey: ['deletedBills'],
    queryFn: () => apiRequest<Invoice[]>('/billing/deleted'),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/billing/invoices/${id}/restore`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedBills'] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      alert('Bill restored successfully');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to restore bill');
    }
  });

  return (
    <div className="p-8 animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <AlertTriangle className="text-amber-500" />
          Deleted Bills Recovery
        </h1>
        <p className="text-gray-400 mt-2">View and restore soft-deleted invoices.</p>
      </div>

      <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">Loading deleted bills...</div>
          ) : bills && bills.length > 0 ? (
            <table className="w-full text-left text-sm text-gray-300">
              <thead>
                <tr className="border-b border-gray-800/80 text-gray-500 uppercase text-xs tracking-wider">
                  <th className="p-6">Bill No</th>
                  <th className="p-6">Date</th>
                  <th className="p-6">Customer</th>
                  <th className="p-6">Total</th>
                  <th className="p-6">Advance Used</th>
                  <th className="p-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {bills.map((bill) => (
                  <tr key={bill._id} className="hover:bg-gray-900/30 transition-all">
                    <td className="p-6 font-bold text-white">{bill.billNo}</td>
                    <td className="p-6">{bill.date}</td>
                    <td className="p-6">{bill.customerName}</td>
                    <td className="p-6 font-semibold text-white">₹{bill.total.toFixed(2)}</td>
                    <td className="p-6 text-emerald-400">₹{(bill.advanceUsed || 0).toFixed(2)}</td>
                    <td className="p-6 text-right">
                      <button
                        onClick={() => restoreMutation.mutate(bill._id)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all cursor-pointer font-medium"
                      >
                        <RotateCcw size={16} /> Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center">
              <RotateCcw size={48} className="mb-4 opacity-20" />
              <p>No deleted bills found in the recycling bin.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

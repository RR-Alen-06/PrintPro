import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/apiClient';
import { Plus, Save } from 'lucide-react';

interface Customer {
  _id: string;
  name: string;
  advanceBalance: number;
}

interface RefundRecord {
  _id: string;
  paymentNo: string;
  customerId: {
    _id: string;
    name: string;
  };
  date: string;
  totalPaid: number;
  cashAmount: number;
  upiAmount: number;
  notes?: string;
}

export default function Refunds() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form states
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => apiRequest<Customer[]>('/customers'),
  });

  const { data: refunds = [], isLoading } = useQuery<RefundRecord[]>({
    queryKey: ['refunds'],
    queryFn: () => apiRequest<RefundRecord[]>('/refunds'),
  });

  const createMutation = useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      resetForm();
      setShowAddForm(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
    mutationFn: (newRefund: any) =>
      apiRequest<RefundRecord>('/refunds', {
        method: 'POST',
        body: JSON.stringify(newRefund),
      }),
  });

  const resetForm = () => {
    setCustomerId('');
    setAmount(0);
    setPaymentMethod('cash');
    setDate(new Date().toISOString().slice(0, 10));
    setNotes('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      alert('Please select a customer.');
      return;
    }
    const customer = customers.find((c) => c._id === customerId);
    if (customer && customer.advanceBalance < amount) {
      alert('Refund amount cannot exceed customer advance balance.');
      return;
    }
    createMutation.mutate({
      customerId,
      amount,
      paymentMethod,
      date,
      notes,
    });
  };

  return (
    <div className="flex-grow bg-[#07060a] text-gray-100 p-8 min-h-screen relative overflow-hidden flex flex-col gap-8">
      {/* Background glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[120px] top-20 right-20 pointer-events-none" />

      {/* Main Refunds List & Form */}
      <div className="flex-1 space-y-6 relative z-10">
        <div className="flex justify-between items-center pb-6 border-b border-gray-800/80">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Customer Refunds</h1>
            <p className="text-gray-400 mt-1">Issue and track refunds settled back to print clients from their advances.</p>
          </div>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              resetForm();
            }}
            className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/15 cursor-pointer text-sm"
          >
            {showAddForm ? 'Cancel' : <><Plus size={18} /> Issue Refund</>}
          </button>
        </div>

        {success && (
          <div className="p-4 mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold">
            Refund transaction recorded successfully!
          </div>
        )}

        {showAddForm && (
          <form onSubmit={handleSubmit} className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 space-y-4 animate-fadeIn">
            <h3 className="font-bold text-white mb-2">Record Customer Refund</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Select Client
                </label>
                <select
                  required
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm cursor-pointer"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} (Current Adv: ₹{c.advanceBalance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Refund Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Refund Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Settlement Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm cursor-pointer"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / Online</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                Description / Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Return of excess advance deposit"
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/15 cursor-pointer text-sm"
              >
                <Save size={18} /> Save Refund
              </button>
            </div>
          </form>
        )}

        {/* History Table */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-6 border-b border-gray-800/80">
              <h3 className="font-bold text-white">Refund Logs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead>
                  <tr className="border-b border-gray-800/80 text-gray-500 uppercase text-xs tracking-wider">
                    <th className="p-6">Date</th>
                    <th className="p-6">Refund ID</th>
                    <th className="p-6">Client</th>
                    <th className="p-6">Settled Via</th>
                    <th className="p-6">Amount Refunded</th>
                    <th className="p-6">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {refunds.map((ref) => (
                    <tr key={ref._id} className="hover:bg-gray-900/30 transition-all">
                      <td className="p-6 text-gray-400">{ref.date}</td>
                      <td className="p-6 font-mono text-xs text-purple-400 font-semibold">{ref.paymentNo}</td>
                      <td className="p-6 font-bold text-white">{ref.customerId?.name || 'Unknown'}</td>
                      <td className="p-6 text-gray-400 capitalize">
                        {ref.cashAmount > 0 ? 'Cash' : 'UPI'}
                      </td>
                      <td className="p-6 text-red-400 font-bold">₹{ref.totalPaid.toFixed(2)}</td>
                      <td className="p-6 text-xs text-gray-500">{ref.notes || '—'}</td>
                    </tr>
                  ))}

                  {refunds.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-gray-500">
                        No customer refunds issued.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

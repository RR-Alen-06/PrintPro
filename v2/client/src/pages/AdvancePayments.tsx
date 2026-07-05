import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/apiClient';
import { Plus, Save } from 'lucide-react';

interface Customer {
  _id: string;
  name: string;
  phone?: string;
  advanceBalance: number;
}

interface AdvanceRecord {
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

export default function AdvancePayments() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form states
  const [customerId, setCustomerId] = useState('');
  const [totalPaid, setTotalPaid] = useState(0);
  const [cashAmount, setCashAmount] = useState(0);
  const [upiAmount, setUpiAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => apiRequest<Customer[]>('/customers'),
  });

  const { data: advances = [], isLoading } = useQuery<AdvanceRecord[]>({
    queryKey: ['advances'],
    queryFn: () => apiRequest<AdvanceRecord[]>('/advance-payments'),
  });

  const createMutation = useMutation({
    mutationFn: (newAdvance: any) =>
      apiRequest<AdvanceRecord>('/advance-payments', {
        method: 'POST',
        body: JSON.stringify(newAdvance),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advances'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      resetForm();
      setShowAddForm(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const resetForm = () => {
    setCustomerId('');
    setTotalPaid(0);
    setCashAmount(0);
    setUpiAmount(0);
    setDate(new Date().toISOString().slice(0, 10));
    setNotes('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      alert('Please select a customer.');
      return;
    }
    createMutation.mutate({
      customerId,
      totalPaid,
      cashAmount,
      upiAmount,
      date,
      notes,
    });
  };

  return (
    <div className="flex-grow bg-[#07060a] text-gray-100 p-8 min-h-screen relative overflow-hidden flex flex-col gap-8">
      {/* Background glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[120px] top-20 right-20 pointer-events-none" />

      {/* Main Advance List & Form */}
      <div className="flex-1 space-y-6 relative z-10">
        <div className="flex justify-between items-center pb-6 border-b border-gray-800/80">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Advance Deposits</h1>
            <p className="text-gray-400 mt-1">Manage print client advance credits and account deposits.</p>
          </div>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              resetForm();
            }}
            className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/15 cursor-pointer text-sm"
          >
            {showAddForm ? 'Cancel' : <><Plus size={18} /> Log Deposit</>}
          </button>
        </div>

        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold">
            Advance deposit logged successfully!
          </div>
        )}

        {showAddForm && (
          <form onSubmit={handleSubmit} className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 space-y-4 animate-fadeIn">
            <h3 className="font-bold text-white mb-2">Record Advance Payment</h3>

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
                  Deposit Date
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Total Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={totalPaid}
                  onChange={(e) => setTotalPaid(Number(e.target.value))}
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Cash Amount (₹)
                </label>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(Number(e.target.value))}
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  UPI Amount (₹)
                </label>
                <input
                  type="number"
                  value={upiAmount}
                  onChange={(e) => setUpiAmount(Number(e.target.value))}
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Deposit for bulk printing job"
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/15 cursor-pointer text-sm"
              >
                <Save size={18} /> Save Deposit
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
              <h3 className="font-bold text-white">Deposit Logs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead>
                  <tr className="border-b border-gray-800/80 text-gray-500 uppercase text-xs tracking-wider">
                    <th className="p-6">Date</th>
                    <th className="p-6">Receipt ID</th>
                    <th className="p-6">Client</th>
                    <th className="p-6">Cash / UPI Splits</th>
                    <th className="p-6">Total Deposited</th>
                    <th className="p-6">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {advances.map((adv) => (
                    <tr key={adv._id} className="hover:bg-gray-900/30 transition-all">
                      <td className="p-6 text-gray-400">{adv.date}</td>
                      <td className="p-6 font-mono text-xs text-purple-400 font-semibold">{adv.paymentNo}</td>
                      <td className="p-6 font-bold text-white">{adv.customerId?.name || 'Unknown'}</td>
                      <td className="p-6 text-xs text-gray-400">
                        <span>Cash: ₹{adv.cashAmount.toFixed(2)}</span>
                        <span className="mx-2">·</span>
                        <span>UPI: ₹{adv.upiAmount.toFixed(2)}</span>
                      </td>
                      <td className="p-6 text-emerald-400 font-bold">₹{adv.totalPaid.toFixed(2)}</td>
                      <td className="p-6 text-xs text-gray-500">{adv.notes || '—'}</td>
                    </tr>
                  ))}

                  {advances.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-gray-500">
                        No advance deposits found.
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

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/apiClient';
import { Plus, Trash2, Save } from 'lucide-react';

interface Customer {
  _id: string;
  name: string;
  type: string;
}

interface RecurringProfile {
  _id: string;
  customerId: {
    _id: string;
    name: string;
    type: string;
  };
  amount: number;
  frequency: string;
  dayOfMonth: number;
  startDate: string;
  active: boolean;
  description?: string;
}

export default function RecurringBills() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form states
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState(0);
  const [frequency, setFrequency] = useState('monthly');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => apiRequest<Customer[]>('/customers'),
  });

  const { data: profiles = [], isLoading } = useQuery<RecurringProfile[]>({
    queryKey: ['recurringBills'],
    queryFn: () => apiRequest<RecurringProfile[]>('/recurring-bills'),
  });

  const createMutation = useMutation({
    mutationFn: (newProfile: any) =>
      apiRequest<RecurringProfile>('/recurring-bills', {
        method: 'POST',
        body: JSON.stringify(newProfile),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringBills'] });
      resetForm();
      setShowAddForm(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<any>(`/recurring-bills/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringBills'] });
    },
  });

  const resetForm = () => {
    setCustomerId('');
    setAmount(0);
    setFrequency('monthly');
    setDayOfMonth(1);
    setStartDate(new Date().toISOString().slice(0, 10));
    setDescription('');
    setActive(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      alert('Please select a customer.');
      return;
    }
    createMutation.mutate({
      customerId,
      amount,
      frequency,
      dayOfMonth,
      startDate,
      active,
      description,
    });
  };

  return (
    <div className="flex-grow bg-[#07060a] text-gray-100 p-8 min-h-screen relative overflow-hidden flex flex-col gap-8">
      {/* Background glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[120px] top-20 right-20 pointer-events-none" />

      {/* Main List & Form */}
      <div className="flex-1 space-y-6 relative z-10">
        <div className="flex justify-between items-center pb-6 border-b border-gray-800/80">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Recurring Invoices</h1>
            <p className="text-gray-400 mt-1">Set up automated weekly/monthly billing profiles for regular accounts.</p>
          </div>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              resetForm();
            }}
            className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/15 cursor-pointer text-sm"
          >
            {showAddForm ? 'Cancel' : <><Plus size={18} /> Add Profile</>}
          </button>
        </div>

        {success && (
          <div className="p-4 mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold">
            Recurring billing profile created successfully!
          </div>
        )}

        {showAddForm && (
          <form onSubmit={handleSubmit} className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 space-y-4 animate-fadeIn">
            <h3 className="font-bold text-white mb-2">Create Recurring Bill Plan</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Select Customer
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
                      {c.name} ({c.type === 'regular' ? 'Regular' : 'Walk-in'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Billing Amount (₹)
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm cursor-pointer"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  {frequency === 'monthly' ? 'Day of Month (1-31)' : 'Day of Week (0-6)'}
                </label>
                <input
                  type="number"
                  min={frequency === 'monthly' ? 1 : 0}
                  max={frequency === 'monthly' ? 31 : 6}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value))}
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                Plan Description / Notes
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Monthly maintenance printer subscription"
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/15 cursor-pointer text-sm"
              >
                <Save size={18} /> Save Plan
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
            <div className="p-6 border-b border-gray-800/80 flex items-center justify-between">
              <h3 className="font-bold text-white">Active Recurring Billing Schedules</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead>
                  <tr className="border-b border-gray-800/80 text-gray-500 uppercase text-xs tracking-wider">
                    <th className="p-6">Customer</th>
                    <th className="p-6">Amount</th>
                    <th className="p-6">Frequency</th>
                    <th className="p-6">Day of Trigger</th>
                    <th className="p-6">Start Date</th>
                    <th className="p-6">Status</th>
                    <th className="p-6 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {profiles.map((p) => (
                    <tr key={p._id} className="hover:bg-gray-900/30 transition-all">
                      <td className="p-6">
                        <div className="font-bold text-white">{p.customerId?.name || 'Unknown'}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5 capitalize">{p.customerId?.type} account</div>
                      </td>
                      <td className="p-6 text-purple-400 font-bold">₹{p.amount.toFixed(2)}</td>
                      <td className="p-6 capitalize">{p.frequency}</td>
                      <td className="p-6">
                        {p.frequency === 'monthly' ? `Day ${p.dayOfMonth}` : `Day ${p.dayOfMonth} of week`}
                      </td>
                      <td className="p-6 text-gray-400">{p.startDate}</td>
                      <td className="p-6">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded ${
                          p.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {p.active ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="p-6 text-center">
                        <button
                          onClick={() => deleteMutation.mutate(p._id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {profiles.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-gray-500">
                        No recurring invoice profiles configured yet.
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

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/apiClient';
import { Plus, Save } from 'lucide-react';

interface ExpenseRecord {
  _id: string;
  title: string;
  amount: number;
  cashAmount: number;
  upiAmount: number;
  category: string;
  date: string;
  description?: string;
}

export default function Expenses() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [cashAmount, setCashAmount] = useState(0);
  const [upiAmount, setUpiAmount] = useState(0);
  const [category, setCategory] = useState('paper');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');

  const { data: expenses = [], isLoading } = useQuery<ExpenseRecord[]>({
    queryKey: ['expenses'],
    queryFn: () => apiRequest<ExpenseRecord[]>('/expenses'),
  });

  const createMutation = useMutation({
    mutationFn: (newExpense: any) =>
      apiRequest<ExpenseRecord>('/expenses', {
        method: 'POST',
        body: JSON.stringify(newExpense),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      resetForm();
      setShowAddForm(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const resetForm = () => {
    setTitle('');
    setCashAmount(0);
    setUpiAmount(0);
    setCategory('paper');
    setDate(new Date().toISOString().slice(0, 10));
    setDescription('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      title,
      cashAmount,
      upiAmount,
      category,
      date,
      description,
    });
  };

  return (
    <div className="flex-grow bg-[#07060a] text-gray-100 p-8 min-h-screen relative overflow-hidden flex flex-col gap-8">
      {/* Background glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[120px] top-20 right-20 pointer-events-none" />

      {/* Main Expenses List & Form */}
      <div className="flex-1 space-y-6 relative z-10">
        <div className="flex justify-between items-center pb-6 border-b border-gray-800/80">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Business Expenses</h1>
            <p className="text-gray-400 mt-1">Track printer upkeep, paper purchases, ink outlays, and utility overheads.</p>
          </div>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              resetForm();
            }}
            className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/15 cursor-pointer text-sm"
          >
            {showAddForm ? 'Cancel' : <><Plus size={18} /> Add Expense</>}
          </button>
        </div>

        {success && (
          <div className="p-4 mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold">
            Expense outlay logged successfully!
          </div>
        )}

        {showAddForm && (
          <form onSubmit={handleSubmit} className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 space-y-4 animate-fadeIn">
            <h3 className="font-bold text-white mb-2">Record Business Expense</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Expense Title / Payee
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Century A4 Paper Box x5"
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Date
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Cash Paid (₹)
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
                  UPI Paid (₹)
                </label>
                <input
                  type="number"
                  value={upiAmount}
                  onChange={(e) => setUpiAmount(Number(e.target.value))}
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm cursor-pointer"
                >
                  <option value="paper">Paper stock</option>
                  <option value="ink">Ink & Toner</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="utilities">Utilities & Rent</option>
                  <option value="other">Other outlays</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Total Outlaid (₹)
                </label>
                <div className="bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white font-bold text-sm">
                  ₹{(cashAmount + upiAmount).toFixed(2)}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                Outlay Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Purchased 5 boxes of Century 75gsm A4 paper"
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/15 cursor-pointer text-sm"
              >
                <Save size={18} /> Save Expense
              </button>
            </div>
          </form>
        )}

        {/* Expenses Table */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-6 border-b border-gray-800/80">
              <h3 className="font-bold text-white">Expense Outlay Logs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead>
                  <tr className="border-b border-gray-800/80 text-gray-500 uppercase text-xs tracking-wider">
                    <th className="p-6">Date</th>
                    <th className="p-6">Outlay</th>
                    <th className="p-6">Category</th>
                    <th className="p-6">Cash / UPI Splits</th>
                    <th className="p-6">Amount Outlaid</th>
                    <th className="p-6">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {expenses.map((exp) => (
                    <tr key={exp._id} className="hover:bg-gray-900/30 transition-all">
                      <td className="p-6 text-gray-400">{exp.date}</td>
                      <td className="p-6 font-bold text-white">{exp.title}</td>
                      <td className="p-6">
                        <span className="inline-flex px-2 py-0.5 text-xs font-semibold capitalize rounded bg-purple-500/10 text-purple-400 border border-purple-500/10">
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-6 text-xs text-gray-400">
                        <span>Cash: ₹{exp.cashAmount?.toFixed(2) || '0.00'}</span>
                        <span className="mx-2">·</span>
                        <span>UPI: ₹{exp.upiAmount?.toFixed(2) || '0.00'}</span>
                      </td>
                      <td className="p-6 text-red-400 font-bold">₹{exp.amount.toFixed(2)}</td>
                      <td className="p-6 text-xs text-gray-500">{exp.description || '—'}</td>
                    </tr>
                  ))}

                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-gray-500">
                        No business expenses recorded yet.
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

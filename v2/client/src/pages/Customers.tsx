import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/apiClient';
import { Plus, Search, Edit3, Trash2, BookOpen } from 'lucide-react';

export interface Customer {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  creditBalance: number;
  advanceBalance: number;
  loyaltyPoints: number;
  type: 'regular' | 'random';
}

interface CustomersProps {
  onViewLedger: (customerId: string) => void;
}

export default function Customers({ onViewLedger }: CustomersProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<'regular' | 'random'>('regular');
  const [creditBalance, setCreditBalance] = useState(0);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => apiRequest<Customer[]>('/customers'),
  });

  const createMutation = useMutation({
    mutationFn: (newCustomer: Partial<Customer>) =>
      apiRequest<Customer>('/customers', {
        method: 'POST',
        body: JSON.stringify(newCustomer),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Customer> }) =>
      apiRequest<Customer>(`/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<Customer>(`/customers/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const openAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setEmail('');
    setType('regular');
    setCreditBalance(0);
    setShowModal(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setPhone(c.phone || '');
    setEmail(c.email || '');
    setType(c.type);
    setCreditBalance(c.creditBalance || 0);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, phone, email, type, creditBalance };
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer._id, updates: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(searchQuery))
  );

  return (
    <div className="flex-1 bg-[#07060a] text-gray-100 p-8 min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[120px] top-20 right-20 pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center mb-8 pb-6 border-b border-gray-800/80">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Customers</h1>
          <p className="text-gray-400 mt-1">Manage print clients, advances, and ledger directories.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/15 cursor-pointer text-sm"
        >
          <Plus size={18} /> Add Customer
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-500">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="Search by customer name or phone number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#0c0b11] border border-gray-800 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all text-sm shadow-sm"
        />
      </div>

      {/* Customers Table */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead>
                <tr className="border-b border-gray-800/80 text-gray-500 uppercase text-xs tracking-wider">
                  <th className="p-6">Client Name</th>
                  <th className="p-6">Contact info</th>
                  <th className="p-6">Client Type</th>
                  <th className="p-6">Ledger Balance</th>
                  <th className="p-6">Advances</th>
                  <th className="p-6">Loyalty Points</th>
                  <th className="p-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {filteredCustomers.map((c) => (
                  <tr key={c._id} className="hover:bg-gray-900/30 transition-all">
                    <td className="p-6 font-bold text-white">{c.name}</td>
                    <td className="p-6">
                      <div className="text-gray-300">{c.phone || '—'}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{c.email || ''}</div>
                    </td>
                    <td className="p-6">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold uppercase rounded-full ${
                        c.type === 'regular'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="p-6 font-semibold">
                      {c.creditBalance > 0 ? (
                        <span className="text-amber-400">₹{c.creditBalance.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-500">₹0.00</span>
                      )}
                    </td>
                    <td className="p-6 text-emerald-400 font-semibold">₹{c.advanceBalance.toFixed(2)}</td>
                    <td className="p-6 font-medium text-gray-400">{c.loyaltyPoints} pts</td>
                    <td className="p-6 text-right">
                      <div className="flex justify-end gap-2.5">
                        <button
                          onClick={() => onViewLedger(c._id)}
                          className="p-2 bg-gray-900 hover:bg-purple-600/20 hover:text-purple-400 border border-gray-800 rounded-lg transition-all cursor-pointer"
                          title="View Ledger Statement"
                        >
                          <BookOpen size={16} />
                        </button>
                        <button
                          onClick={() => openEditModal(c)}
                          className="p-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg transition-all cursor-pointer"
                          title="Edit"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete ${c.name}?`)) {
                              deleteMutation.mutate(c._id);
                            }
                          }}
                          className="p-2 bg-gray-900 hover:bg-red-500/15 hover:text-red-400 border border-gray-800 rounded-lg transition-all cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-gray-500">
                      No print clients found matching your query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fadeIn">
          <div className="bg-[#0c0b11] border border-gray-800 rounded-3xl w-full max-w-lg p-8 shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-6">
              {editingCustomer ? 'Modify Client Profile' : 'Add New Client Profile'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Customer Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. client@gmail.com"
                    className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
                  >
                    <option value="regular">Regular Client</option>
                    <option value="random">Walk-in Client</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                    Opening Credit Due (₹)
                  </label>
                  <input
                    type="number"
                    value={creditBalance}
                    onChange={(e) => setCreditBalance(Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-3 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition-all text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all text-sm font-semibold cursor-pointer shadow-lg shadow-purple-500/15"
                >
                  {editingCustomer ? 'Update Profile' : 'Add Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

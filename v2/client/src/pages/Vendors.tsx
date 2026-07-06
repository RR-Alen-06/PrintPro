import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/apiClient';
import { Plus, Search, Edit3, Trash2, DollarSign } from 'lucide-react';

interface Vendor {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  outstandingBalance: number;
}

export default function Vendors() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [contactPerson, setContactPerson] = useState('');

  // Payment states
  const [payingVendor, setPayingVendor] = useState<Vendor | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: () => apiRequest<Vendor[]>('/vendors'),
  });

  const createMutation = useMutation({
    mutationFn: (newVendor: Partial<Vendor>) =>
      apiRequest<Vendor>('/vendors', {
        method: 'POST',
        body: JSON.stringify(newVendor),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Vendor> }) =>
      apiRequest<Vendor>(`/vendors/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      closeModal();
    },
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      apiRequest<any>(`/vendors/${id}/adjust-balance`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setPayingVendor(null);
      setPaymentAmount(0);
      alert('Payment registered successfully!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<Vendor>(`/vendors/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });

  const openAddModal = () => {
    setEditingVendor(null);
    setName('');
    setPhone('');
    setEmail('');
    setContactPerson('');
    setShowModal(true);
  };

  const openEditModal = (v: Vendor) => {
    setEditingVendor(v);
    setName(v.name);
    setPhone(v.phone || '');
    setEmail(v.email || '');
    setContactPerson(v.contactPerson || '');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingVendor(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, phone, email, contactPerson };
    if (editingVendor) {
      updateMutation.mutate({ id: editingVendor._id, updates: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredVendors = vendors.filter((v) =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.contactPerson && v.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex-grow bg-[#07060a] text-gray-100 p-8 min-h-screen relative overflow-hidden flex flex-col gap-6">
      {/* Glow Effects */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[120px] top-20 right-20 pointer-events-none" />

      <div className="flex justify-between items-center z-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Vendor Directory</h1>
          <p className="text-gray-400 mt-1">Manage print suppliers, paper vendors, and track Accounts Payable.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all cursor-pointer text-sm shadow-lg shadow-purple-500/15"
        >
          <Plus size={18} /> Add Vendor
        </button>
      </div>

      <div className="relative mb-2 z-10">
        <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-500">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="Search by vendor name or contact person..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#0c0b11] border border-gray-800 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all text-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20 flex-grow">
          <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-[#0c0b11] border border-gray-800 rounded-2xl overflow-hidden shadow-lg z-10">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 uppercase text-xs tracking-wider">
                  <th className="p-6">Vendor Name</th>
                  <th className="p-6">Contact info</th>
                  <th className="p-6">Representative</th>
                  <th className="p-6">Outstanding Dues</th>
                  <th className="p-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {filteredVendors.map((v) => (
                  <tr key={v._id} className="hover:bg-gray-900/30 transition-all">
                    <td className="p-6 font-bold text-white">{v.name}</td>
                    <td className="p-6">
                      <div className="text-gray-300">{v.phone || '—'}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{v.email || ''}</div>
                    </td>
                    <td className="p-6 text-gray-400 font-medium">{v.contactPerson || '—'}</td>
                    <td className="p-6 font-bold">
                      {v.outstandingBalance > 0 ? (
                        <span className="text-rose-400">₹{v.outstandingBalance.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-500">₹0.00</span>
                      )}
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex justify-end gap-2.5">
                        {v.outstandingBalance > 0 && (
                          <button
                            onClick={() => setPayingVendor(v)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
                            title="Settle Dues"
                          >
                            <DollarSign size={13} /> Settle Dues
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(v)}
                          className="p-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg transition-all cursor-pointer"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete vendor ${v.name}?`)) {
                              deleteMutation.mutate(v._id);
                            }
                          }}
                          className="p-2 bg-gray-900 hover:bg-red-500/15 hover:text-red-400 border border-gray-800 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredVendors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-gray-500">
                      No print suppliers/vendors registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fadeIn">
          <div className="bg-[#0c0b11] border border-gray-800 rounded-3xl w-full max-w-md p-8 shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-6">
              {editingVendor ? 'Modify Vendor Profile' : 'Add New Print Vendor'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Vendor Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Century Paper Mill"
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Representative Contact Person</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sales@century.com"
                    className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none"
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
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all text-sm font-semibold cursor-pointer shadow-lg"
                >
                  {editingVendor ? 'Update Vendor' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Dues Modal */}
      {payingVendor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fadeIn">
          <div className="bg-[#0c0b11] border border-gray-800 rounded-3xl w-full max-w-sm p-8 shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-2">Record Vendor Payment</h2>
            <p className="text-xs text-gray-500 mb-6">Vendor: {payingVendor.name} (Outstanding: ₹{payingVendor.outstandingBalance.toFixed(2)})</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Payment Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setPayingVendor(null);
                    setPaymentAmount(0);
                  }}
                  className="px-5 py-3 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition-all text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => adjustMutation.mutate({
                    id: payingVendor._id,
                    amount: -paymentAmount, // Negative amount to reduce outstanding balance
                  })}
                  disabled={adjustMutation.isPending || paymentAmount <= 0}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all text-sm font-semibold cursor-pointer shadow-lg"
                >
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

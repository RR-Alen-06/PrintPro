import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/apiClient';
import { Trash2, Save, Users, AlertTriangle } from 'lucide-react';

interface Customer {
  _id: string;
  name: string;
  type: string;
  advanceBalance: number;
}


interface GroupMember {
  id: string;
  customerId: string;
  discountValue: number;
  discountType: string;
  useAdvance: boolean;
  cashPaid: number;
  upiPaid: number;
  customGst?: number;
}

export default function GroupBilling() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'shared' | 'split'>('shared');
  const [success, setSuccess] = useState(false);

  // Shared print job items
  const [items, setItems] = useState<{ name: string; qty: number; unitPrice: number; gstRate: number }[]>([
    { name: '', qty: 1, unitPrice: 0, gstRate: 0 }
  ]);

  // Group members
  const [members, setMembers] = useState<GroupMember[]>([
    { id: 'm-1', customerId: '', discountValue: 0, discountType: 'flat', useAdvance: false, cashPaid: 0, upiPaid: 0 }
  ]);

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => apiRequest<Customer[]>('/customers'),
  });



  const groupMutation = useMutation({
    mutationFn: (payload: any) =>
      apiRequest('/billing/group-invoice', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      resetPage();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const resetPage = () => {
    setItems([{ name: '', qty: 1, unitPrice: 0, gstRate: 0 }]);
    setMembers([{ id: 'm-1', customerId: '', discountValue: 0, discountType: 'flat', useAdvance: false, cashPaid: 0, upiPaid: 0 }]);
  };

  const handleAddItemRow = () => {
    setItems([...items, { name: '', qty: 1, unitPrice: 0, gstRate: 0 }]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: string, val: any) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: val };
    setItems(next);
  };

  const handleAddMember = () => {
    setMembers([
      ...members,
      { id: `m-${Date.now()}`, customerId: '', discountValue: 0, discountType: 'flat', useAdvance: false, cashPaid: 0, upiPaid: 0 }
    ]);
  };

  const handleRemoveMember = (id: string) => {
    setMembers(members.filter((m) => m.id !== id));
  };

  const handleMemberChange = (id: string, field: string, val: any) => {
    setMembers(
      members.map((m) => {
        if (m.id !== id) return m;
        return { ...m, [field]: val };
      })
    );
  };

  // Calculations
  const calculatedSubtotal = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const calculatedGst = items.reduce((sum, item) => sum + (item.qty * item.unitPrice * (item.gstRate || 0)) / 100, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (members.some((m) => !m.customerId)) {
      alert('Please select a customer for all group members.');
      return;
    }

    // Build the payload members
    const payloadMembers = members.map((m) => {
      // In shared mode, each customer gets the full list of items.
      // In split mode, the items list is divided equally among members.
      const memberItems = items.map((item) => ({
        name: item.name,
        qty: mode === 'shared' ? item.qty : Math.max(1, Math.round(item.qty / members.length)),
        unitPrice: mode === 'shared' ? item.unitPrice : Number((item.unitPrice / members.length).toFixed(2)),
        gstRate: item.gstRate,
      }));

      return {
        customerId: m.customerId,
        items: memberItems,
        discountValue: m.discountValue,
        discountType: m.discountType,
        useAdvance: m.useAdvance,
        cashPaid: m.cashPaid,
        upiPaid: m.upiPaid,
        customGst: m.customGst,
      };
    });

    groupMutation.mutate({
      mode,
      date: new Date().toISOString().slice(0, 10),
      members: payloadMembers,
    });
  };

  return (
    <div className="flex-grow bg-[#07060a] text-gray-100 p-8 min-h-screen relative overflow-hidden flex flex-col gap-8">
      {/* Background glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[120px] top-20 right-20 pointer-events-none" />

      <div className="flex-grow space-y-6 relative z-10">
        {/* Header */}
        <div className="flex justify-between items-center pb-6 border-b border-gray-800/80">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Users size={28} className="text-purple-400" /> Group Billing
            </h1>
            <p className="text-gray-400 mt-1">Consolidate shared corporate print jobs or split copy invoices among multiple accounts.</p>
          </div>

          <div className="flex items-center bg-[#0c0b11] border border-gray-800 rounded-xl p-1.5">
            <button
              onClick={() => setMode('shared')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'shared' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Shared Mode
            </button>
            <button
              onClick={() => setMode('split')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'split' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Split Mode
            </button>
          </div>
        </div>

        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold">
            Group invoice saved atomically successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Print items manager */}
          <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-white mb-2">
              {mode === 'shared' ? 'Shared Print Jobs / Items' : 'Total Print Job to Split'}
            </h3>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Spiral Binding B/W"
                      value={item.name}
                      onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                      className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500 text-sm"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="Qty"
                      value={item.qty}
                      onChange={(e) => handleItemChange(idx, 'qty', Number(e.target.value))}
                      className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500 text-sm text-center"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder="Rate"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(idx, 'unitPrice', Number(e.target.value))}
                      className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={item.gstRate}
                      onChange={(e) => handleItemChange(idx, 'gstRate', Number(e.target.value))}
                      className="flex-1 bg-[#13121a] border border-gray-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500 text-sm cursor-pointer"
                    >
                      <option value={0}>0% GST</option>
                      <option value={5}>5% GST</option>
                      <option value={12}>12% GST</option>
                      <option value={18}>18% GST</option>
                    </select>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-all cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddItemRow}
              className="mt-2 text-purple-400 hover:text-purple-300 font-semibold text-xs cursor-pointer"
            >
              + Add Item Line
            </button>
          </div>

          {/* Group members manager */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white text-base">Group Members Invoices</h3>
              <button
                type="button"
                onClick={handleAddMember}
                className="px-4 py-2 bg-purple-600/10 border border-purple-500/20 text-purple-400 hover:bg-purple-600/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                + Add Member
              </button>
            </div>

            <div className="space-y-4">
              {members.map((m, idx) => {
                const customer = customers.find((c) => c._id === m.customerId);
                // Calculate invoice total for this member
                const mSub = mode === 'shared' ? calculatedSubtotal : calculatedSubtotal / members.length;
                const mGst = mode === 'shared' ? calculatedGst : calculatedGst / members.length;
                const mDisc = m.discountType === 'percent' ? (mSub * m.discountValue) / 100 : m.discountValue;
                const mTotal = Math.max(0, mSub + mGst - mDisc);

                return (
                  <div key={m.id} className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-gray-800/40">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-purple-600/20 text-purple-400 border border-purple-500/20 flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </span>
                        <select
                          required
                          value={m.customerId}
                          onChange={(e) => handleMemberChange(m.id, 'customerId', e.target.value)}
                          className="bg-[#13121a] border border-gray-800 rounded-xl p-2 text-xs font-semibold text-white focus:outline-none cursor-pointer min-w-[200px]"
                        >
                          <option value="">-- Choose Client --</option>
                          {customers.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.name} (Adv: ₹{c.advanceBalance.toFixed(2)})
                            </option>
                          ))}
                        </select>

                        {customer && customer.advanceBalance > 0 && (
                          <label className="flex items-center gap-1.5 text-xs text-emerald-400 cursor-pointer bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                            <input
                              type="checkbox"
                              checked={m.useAdvance}
                              onChange={(e) => handleMemberChange(m.id, 'useAdvance', e.target.checked)}
                            />
                            Use Advance (₹{customer.advanceBalance})
                          </label>
                        )}
                      </div>

                      {members.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.id)}
                          className="text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 tracking-wider">
                          Discount Type
                        </label>
                        <select
                          value={m.discountType}
                          onChange={(e) => handleMemberChange(m.id, 'discountType', e.target.value)}
                          className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                        >
                          <option value="flat">₹ Flat</option>
                          <option value="percent">% Off</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 tracking-wider">
                          Discount Value
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={m.discountValue}
                          onChange={(e) => handleMemberChange(m.id, 'discountValue', Number(e.target.value))}
                          className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 tracking-wider">
                          Cash Paid (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={m.cashPaid}
                          onChange={(e) => handleMemberChange(m.id, 'cashPaid', Number(e.target.value))}
                          className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 tracking-wider">
                          UPI Paid (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={m.upiPaid}
                          onChange={(e) => handleMemberChange(m.id, 'upiPaid', Number(e.target.value))}
                          className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-[#13121a]/50 p-4 rounded-xl border border-gray-800/40">
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <p>Subtotal: ₹{mSub.toFixed(2)}</p>
                        <p>GST: ₹{mGst.toFixed(2)}</p>
                        <p>Discount: -₹{mDisc.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-gray-500 uppercase font-bold block">Invoice Total</span>
                        <span className="text-lg font-black text-purple-400">₹{mTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit bar */}
          <div className="flex justify-between items-center bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6">
            <div className="flex items-center gap-2.5 text-amber-400">
              <AlertTriangle size={18} />
              <span className="text-xs font-semibold">
                Saving will generate {members.length} individual child bills + 1 parent group bill atomically.
              </span>
            </div>

            <button
              type="submit"
              disabled={groupMutation.isPending}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/15 cursor-pointer text-sm"
            >
              <Save size={18} /> Save Group Bill
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

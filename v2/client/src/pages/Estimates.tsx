import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/apiClient';
import { Plus, Trash2, Save, CheckCircle, FileUp, Printer } from 'lucide-react';
import type { Customer } from './Customers';
import { generateDocumentPDF } from '../lib/pdfGenerator';

interface EstimateItem {
  name: string;
  qty: number;
  unitPrice: number;
  discountValue: number;
  discountType: 'flat' | 'percent';
  gstRate: number;
}

interface Estimate {
  _id: string;
  estimateNo: string;
  customerName: string;
  date: string;
  subtotal: number;
  discountAmount: number;
  gstAmount: number;
  total: number;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'invoiced';
  items: any[];
  convertedBillId?: string;
}

export default function Estimates() {
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form States
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState('');
  const [items, setItems] = useState<EstimateItem[]>([
    { name: 'A4 Color Print Job', qty: 100, unitPrice: 8, discountValue: 0, discountType: 'flat', gstRate: 18 }
  ]);
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [notes, setNotes] = useState('');

  // Conversion States
  const [convertingEstimate, setConvertingEstimate] = useState<Estimate | null>(null);
  const [amountPaid, setAmountPaid] = useState(0);
  const [cashPaid, setCashPaid] = useState(0);
  const [upiPaid, setUpiPaid] = useState(0);
  const [advanceUsed, setAdvanceUsed] = useState(0);

  // Queries
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => apiRequest<Customer[]>('/customers'),
  });

  const { data: settings } = useQuery<any>({
    queryKey: ['settings'],
    queryFn: () => apiRequest<any>('/settings'),
  });

  const defaultGstRate = settings?.gstRate ?? 18;

  const { data: estimates = [] } = useQuery<Estimate[]>({
    queryKey: ['estimates'],
    queryFn: () => apiRequest<Estimate[]>('/estimates'),
  });

  const createMutation = useMutation({
    mutationFn: (newEstimate: any) =>
      apiRequest<Estimate>('/estimates', {
        method: 'POST',
        body: JSON.stringify(newEstimate),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      setSuccess(true);
      setIsCreating(false);
      resetForm();
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const convertMutation = useMutation({
    mutationFn: ({ id, payment }: { id: string; payment: any }) =>
      apiRequest<any>(`/estimates/${id}/convert`, {
        method: 'POST',
        body: JSON.stringify(payment),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setConvertingEstimate(null);
      alert('Estimate converted to invoice successfully!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<any>(`/estimates/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
    },
  });

  const resetForm = () => {
    setCustomerId('');
    setItems([{ name: 'A4 Color Print Job', qty: 100, unitPrice: 8, discountValue: 0, discountType: 'flat', gstRate: defaultGstRate }]);
    setDiscountValue(0);
    setNotes('');
  };

  const addItemRow = () => {
    setItems([...items, { name: '', qty: 1, unitPrice: 0, discountValue: 0, discountType: 'flat', gstRate: defaultGstRate }]);
  };

  const removeItemRow = (index: number) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const updateItemField = (index: number, field: keyof EstimateItem, val: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: val };
    setItems(updated);
  };

  const calculateTotals = () => {
    let itemsSubtotal = 0;
    let itemsDiscount = 0;
    let computedGstAmount = 0;

    items.forEach((item) => {
      const subtotal = item.qty * item.unitPrice;
      let disc = 0;
      if (item.discountType === 'percent') {
        disc = Number(((subtotal * item.discountValue) / 100).toFixed(2));
      } else {
        disc = Math.min(item.discountValue, subtotal);
      }
      const netSub = subtotal - disc;
      itemsSubtotal += subtotal;
      itemsDiscount += disc;
      const gst = Number(((netSub * item.gstRate) / 100).toFixed(2));
      computedGstAmount += gst;
    });

    let invoiceDiscount = 0;
    const netAfterItemDiscount = itemsSubtotal - itemsDiscount;
    if (discountValue > 0) {
      if (discountType === 'percent') {
        invoiceDiscount = Number(((netAfterItemDiscount * discountValue) / 100).toFixed(2));
      } else {
        invoiceDiscount = Math.min(discountValue, netAfterItemDiscount);
      }
    }

    const subtotal = itemsSubtotal;
    const discountAmount = itemsDiscount + invoiceDiscount;
    const total = Number((subtotal - discountAmount + computedGstAmount).toFixed(2));

    return { subtotal, discountAmount, gstAmount: computedGstAmount, total };
  };

  const totals = calculateTotals();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return;
    createMutation.mutate({
      customerId,
      date,
      validUntil,
      items,
      discountValue,
      discountType,
      notes,
    });
  };

  return (
    <div className="flex-grow bg-[#07060a] text-gray-100 p-8 min-h-screen relative overflow-hidden flex flex-col gap-8">
      {/* Glow Effects */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[120px] top-20 right-20 pointer-events-none" />

      <div className="flex justify-between items-center z-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Quotations & Estimates</h1>
          <p className="text-gray-400 mt-1">Compose quotes and convert approved jobs directly to bills.</p>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all cursor-pointer text-sm"
          >
            <Plus size={18} /> Create Estimate
          </button>
        )}
      </div>

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold flex items-center gap-2">
          <CheckCircle size={18} /> Estimate created successfully!
        </div>
      )}

      {isCreating ? (
        <form onSubmit={handleSubmit} className="space-y-6 z-10 max-w-5xl">
          <div className="bg-[#0c0b11] border border-gray-800 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Select Client</label>
              <select
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 text-sm cursor-pointer"
              >
                <option value="">-- Select Client --</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Estimate Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Valid Until</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 text-sm"
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-[#0c0b11] border border-gray-800 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-800/40 pb-3">
              <h3 className="font-bold text-white uppercase text-purple-400 text-sm">Quote Lines</h3>
              <button
                type="button"
                onClick={addItemRow}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white rounded-lg text-xs font-semibold border border-purple-500/20 transition-all cursor-pointer"
              >
                <Plus size={14} /> Add Row
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-[#13121a]/50 p-4 rounded-xl border border-gray-800/30">
                  <div className="md:col-span-4">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Item Description</label>
                    <input
                      type="text"
                      required
                      value={item.name}
                      onChange={(e) => updateItemField(index, 'name', e.target.value)}
                      className="w-full bg-[#13121a] border border-gray-800 rounded-lg p-2.5 text-white text-xs focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Qty</label>
                    <input
                      type="number"
                      required
                      value={item.qty}
                      onChange={(e) => updateItemField(index, 'qty', Number(e.target.value))}
                      className="w-full bg-[#13121a] border border-gray-800 rounded-lg p-2.5 text-white text-xs focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={item.unitPrice}
                      onChange={(e) => updateItemField(index, 'unitPrice', Number(e.target.value))}
                      className="w-full bg-[#13121a] border border-gray-800 rounded-lg p-2.5 text-white text-xs focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tax (%)</label>
                    <input
                      type="number"
                      value={item.gstRate}
                      onChange={(e) => updateItemField(index, 'gstRate', Number(e.target.value))}
                      className="w-full bg-[#13121a] border border-gray-800 rounded-lg p-2.5 text-white text-xs focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2 text-center pb-2 bg-[#0c0b11] p-2 rounded-lg border border-gray-800/40">
                    <div className="text-[10px] font-bold text-gray-500">Subtotal</div>
                    <div className="text-sm font-bold text-white mt-1">₹{(item.qty * item.unitPrice).toFixed(2)}</div>
                  </div>
                  <div className="md:col-span-1 text-right">
                    <button
                      type="button"
                      disabled={items.length <= 1}
                      onClick={() => removeItemRow(index)}
                      className="p-2.5 text-gray-500 hover:text-red-400 bg-[#0c0b11] hover:bg-red-500/10 rounded-lg border border-gray-800 cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#0c0b11] border border-gray-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-white uppercase text-purple-400 text-xs">Summary Breakdown</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Gross Items Subtotal</span>
                  <span>₹{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-400 items-center">
                  <span>Invoice Discount</span>
                  <div className="flex gap-2 w-48">
                    <input
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Number(e.target.value))}
                      className="w-full bg-[#13121a] border border-gray-800 rounded-lg p-1.5 text-white text-xs focus:outline-none"
                    />
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as any)}
                      className="bg-[#13121a] border border-gray-800 rounded-lg p-1.5 text-white text-xs focus:outline-none"
                    >
                      <option value="flat">Flat</option>
                      <option value="percent">%</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>GST Tax Collected</span>
                  <span>₹{totals.gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white font-black text-lg border-t border-gray-800/40 pt-3">
                  <span>Total Estimated</span>
                  <span>₹{totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0c0b11] border border-gray-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-white uppercase text-purple-400 text-xs">Internal Notes</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Include custom terms or details about this print job quote..."
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3.5 text-white placeholder-gray-600 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-5 py-3 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition-all text-sm font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-6 py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg cursor-pointer text-sm"
            >
              <Save size={18} /> Save Estimate
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-[#0c0b11] border border-gray-800 rounded-2xl overflow-hidden shadow-lg z-10">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 uppercase text-xs tracking-wider">
                  <th className="p-6">Estimate No</th>
                  <th className="p-6">Client</th>
                  <th className="p-6">Date</th>
                  <th className="p-6">Total Amount</th>
                  <th className="p-6">Status</th>
                  <th className="p-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {estimates.map((est) => (
                  <tr key={est._id} className="hover:bg-gray-900/30 transition-all">
                    <td className="p-6 font-bold text-white font-mono">{est.estimateNo}</td>
                    <td className="p-6">{est.customerName}</td>
                    <td className="p-6">{est.date}</td>
                    <td className="p-6 font-bold text-white">₹{est.total.toFixed(2)}</td>
                    <td className="p-6">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold uppercase rounded-full ${
                        est.status === 'invoiced'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : est.status === 'declined'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {est.status}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex justify-end gap-2">
                        {est.status !== 'invoiced' && (
                          <button
                            onClick={() => setConvertingEstimate(est)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
                          >
                            <FileUp size={14} /> Invoice Job
                          </button>
                        )}
                        <button
                          onClick={() => generateDocumentPDF('estimate', est)}
                          className="p-2 bg-gray-900 hover:bg-purple-500/15 hover:text-purple-400 border border-gray-800 rounded-lg transition-all cursor-pointer"
                          title="Download PDF Estimate"
                        >
                          <Printer size={15} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Delete this estimate?')) {
                              deleteMutation.mutate(est._id);
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

                {estimates.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-gray-500">
                      No estimations recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Convert to Invoice Modal */}
      {convertingEstimate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fadeIn">
          <div className="bg-[#0c0b11] border border-gray-800 rounded-3xl w-full max-w-md p-8 shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-2">Convert to Print Invoice</h2>
            <p className="text-xs text-gray-500 mb-6">Estimate: {convertingEstimate.estimateNo} (Total: ₹{convertingEstimate.total.toFixed(2)})</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Amount Paid (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(Number(e.target.value))}
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Cash paid</label>
                  <input
                    type="number"
                    value={cashPaid}
                    onChange={(e) => setCashPaid(Number(e.target.value))}
                    className="w-full bg-[#13121a] border border-gray-800 rounded-lg p-2 text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">UPI paid</label>
                  <input
                    type="number"
                    value={upiPaid}
                    onChange={(e) => setUpiPaid(Number(e.target.value))}
                    className="w-full bg-[#13121a] border border-gray-800 rounded-lg p-2 text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Advance Balance Used (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={advanceUsed}
                  onChange={(e) => setAdvanceUsed(Number(e.target.value))}
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setConvertingEstimate(null)}
                  className="px-5 py-3 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition-all text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => convertMutation.mutate({
                    id: convertingEstimate._id,
                    payment: { amountPaid, cashPaid, upiPaid, advanceUsed }
                  })}
                  disabled={convertMutation.isPending}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all text-sm font-semibold cursor-pointer shadow-lg"
                >
                  Confirm & Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

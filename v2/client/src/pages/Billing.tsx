import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/apiClient';
import { Plus, Trash2, Save, FileText, CheckCircle, Printer } from 'lucide-react';
import { generateDocumentPDF } from '../lib/pdfGenerator';

interface Customer {
  _id: string;
  name: string;
  advanceBalance: number;
}

interface BillItem {
  name: string;
  qty: number;
  unitPrice: number;
  discountValue: number;
  discountType: 'flat' | 'percent';
  gstRate: number;
}

export interface Invoice {
  _id: string;
  billNo: string;
  customerName: string;
  date: string;
  subtotal: number;
  discountAmount: number;
  gstAmount: number;
  total: number;
  amountPaid: number;
  balance: number;
  advanceUsed?: number;
  status: string;
  isGroupParent?: boolean;
  items: any[];
}

export default function Billing() {
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState(false);

  // Core Invoice States
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<BillItem[]>([
    { name: 'A4 Printing', qty: 10, unitPrice: 5, discountValue: 0, discountType: 'flat', gstRate: 18 }
  ]);
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
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

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => apiRequest<Invoice[]>('/billing/invoices'),
  });

  const createMutation = useMutation({
    mutationFn: (newInvoice: any) =>
      apiRequest<Invoice>('/billing/invoice', {
        method: 'POST',
        body: JSON.stringify(newInvoice),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setSuccess(true);
      resetBillingForm();
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const resetBillingForm = () => {
    setCustomerId('');
    setItems([{ name: 'A4 Printing', qty: 10, unitPrice: 5, discountValue: 0, discountType: 'flat', gstRate: defaultGstRate }]);
    setDiscountValue(0);
    setAmountPaid(0);
    setCashPaid(0);
    setUpiPaid(0);
    setAdvanceUsed(0);
  };

  const addItemRow = () => {
    setItems([...items, { name: '', qty: 1, unitPrice: 0, discountValue: 0, discountType: 'flat', gstRate: defaultGstRate }]);
  };

  const removeItemRow = (index: number) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const updateItemField = (index: number, field: keyof BillItem, val: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: val };
    setItems(updated);
  };

  // Real-time calculations matching backend/V1 logic
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
    if (!customerId) {
      alert('Please select a customer.');
      return;
    }

    createMutation.mutate({
      customerId,
      date,
      dueDate,
      items,
      discountValue,
      discountType,
      amountPaid,
      advanceUsed,
      cashPaid,
      upiPaid,
    });
  };

  return (
    <div className="flex-grow bg-[#07060a] text-gray-100 p-8 min-h-screen relative overflow-hidden flex flex-col lg:flex-row gap-8">
      {/* Background glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[120px] top-20 right-20 pointer-events-none" />

      {/* Main Invoice Form Column */}
      <div className="flex-1 space-y-6 relative z-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Generate Print Bill</h1>
          <p className="text-gray-400 mt-1">Compose print line items and finalize payment splits.</p>
        </div>

        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold flex items-center gap-2">
            <CheckCircle size={18} /> Invoice created successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client & Date Card */}
          <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <option value="">-- Select Client --</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} (Adv: ₹{c.advanceBalance.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                Invoice Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>
          </div>

          {/* Line Items Card */}
          <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-800/40">
              <h3 className="font-bold text-white uppercase tracking-wider text-purple-400 text-sm">Print Job Lines</h3>
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
                      placeholder="e.g. A3 Color Single Side"
                      onChange={(e) => updateItemField(index, 'name', e.target.value)}
                      className="w-full bg-[#13121a] border border-gray-800 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Quantity</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={item.qty}
                      onChange={(e) => updateItemField(index, 'qty', Number(e.target.value))}
                      className="w-full bg-[#13121a] border border-gray-800 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Unit Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) => updateItemField(index, 'unitPrice', Number(e.target.value))}
                      className="w-full bg-[#13121a] border border-gray-800 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tax (%)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={item.gstRate}
                      onChange={(e) => updateItemField(index, 'gstRate', Number(e.target.value))}
                      className="w-full bg-[#13121a] border border-gray-800 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="md:col-span-2 text-center pb-2 bg-[#0c0b11] p-2 rounded-lg border border-gray-800/40">
                    <div className="text-[10px] font-bold text-gray-500 uppercase">Subtotal</div>
                    <div className="text-sm font-bold text-white mt-1">₹{(item.qty * item.unitPrice).toFixed(2)}</div>
                  </div>

                  <div className="md:col-span-1 text-right">
                    <button
                      type="button"
                      disabled={items.length <= 1}
                      onClick={() => removeItemRow(index)}
                      className="p-2.5 text-gray-500 hover:text-red-400 bg-[#0c0b11] hover:bg-red-500/10 rounded-lg border border-gray-800/60 hover:border-red-500/20 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Invoice Summary and Payments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Calculation details */}
            <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-white uppercase tracking-wider text-purple-400 text-xs">Summary Breakdown</h3>
              
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Gross Items Subtotal</span>
                  <span>₹{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-400 items-center gap-4">
                  <span>Invoice Discount</span>
                  <div className="flex gap-2 w-48">
                    <input
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Number(e.target.value))}
                      className="w-full bg-[#13121a] border border-gray-800 rounded-lg p-1.5 text-white text-xs focus:outline-none focus:border-purple-500"
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
                  <span>Grand Invoice Total</span>
                  <span>₹{totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payments Splits */}
            <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-white uppercase tracking-wider text-purple-400 text-xs">Settlement / Payments</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                    Total Amount Paid (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(Number(e.target.value))}
                    className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                    Advance Balance Used (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={advanceUsed}
                    onChange={(e) => setAdvanceUsed(Number(e.target.value))}
                    className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Cash Collection</label>
                  <input
                    type="number"
                    value={cashPaid}
                    onChange={(e) => setCashPaid(Number(e.target.value))}
                    className="w-full bg-[#13121a] border border-gray-800 rounded-lg p-2 text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">UPI Collection</label>
                  <input
                    type="number"
                    value={upiPaid}
                    onChange={(e) => setUpiPaid(Number(e.target.value))}
                    className="w-full bg-[#13121a] border border-gray-800 rounded-lg p-2 text-white text-xs focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-6 py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/15 cursor-pointer text-sm"
            >
              <Save size={18} /> Generate Invoice
            </button>
          </div>
        </form>
      </div>

      {/* Recent Invoices Column */}
      <div className="w-full lg:w-96 shrink-0 space-y-6 relative z-10 border-t lg:border-t-0 lg:border-l border-gray-800/80 lg:pl-8 pt-8 lg:pt-0">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText size={20} className="text-purple-400" /> Recent Invoices
          </h2>
          <p className="text-xs text-gray-500 mt-1">Review list of print invoices generated today.</p>
        </div>

        <div className="space-y-3.5 max-h-[70vh] overflow-y-auto pr-1">
          {invoices.map((inv) => (
            <div key={inv._id} className="bg-[#0c0b11] border border-gray-800/60 rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-start">
                <span className="font-mono text-purple-400 font-bold text-xs">{inv.billNo}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => generateDocumentPDF('invoice', inv)}
                    className="p-1 bg-[#13121a] hover:bg-gray-800 border border-gray-800 rounded text-gray-400 hover:text-white transition-all cursor-pointer"
                    title="Download PDF"
                  >
                    <Printer size={12} />
                  </button>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${
                    inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                    inv.status === 'partial' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    {inv.status}
                  </span>
                </div>
              </div>
              <div className="text-sm font-bold text-white truncate">{inv.customerName}</div>
              <div className="flex justify-between items-center text-xs text-gray-400 pt-1 border-t border-gray-800/20">
                <span>Total: ₹{inv.total.toFixed(2)}</span>
                <span>Due: ₹{inv.balance.toFixed(2)}</span>
              </div>
            </div>
          ))}

          {invoices.length === 0 && (
            <div className="text-center py-12 text-gray-600 text-sm">
              No bills created.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

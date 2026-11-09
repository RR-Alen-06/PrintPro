'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ApiService } from '@/lib/services/api';
import { Bill, Product, Customer, AllSettings, RoundingMethod } from '@/lib/types';
import { 
  X, 
  Plus, 
  Trash2, 
  ShieldAlert, 
  AlertTriangle, 
  Receipt, 
  User, 
  CreditCard, 
  Lock,
  Package,
  Calculator,
  Save,
  Loader2
} from 'lucide-react';

interface EditBillModalProps {
  bill: Bill;
  onClose: () => void;
  onSaved: (updatedBill: Bill) => void;
}

interface EditableItem {
  id?: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
}

export function EditBillModal({ bill, onClose, onSaved }: EditBillModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form states
  const [customerId, setCustomerId] = useState<string>(bill.customer_id || '');
  const [items, setItems] = useState<EditableItem[]>(() => {
    const raw = bill.items || (bill as unknown as { bill_items?: EditableItem[] }).bill_items || [];
    if (raw.length > 0) {
      return raw.map(it => ({
        id: it.id,
        product_id: it.product_id || null,
        product_name: it.product_name,
        quantity: Number(it.quantity || 1),
        price: Number(it.price || 0),
        total: Number((Number(it.quantity || 1) * Number(it.price || 0)).toFixed(2))
      }));
    }
    return [{
      product_name: 'General Item',
      quantity: 1,
      price: Number(bill.grand_total || 0),
      total: Number(bill.grand_total || 0)
    }];
  });

  const [discount, setDiscount] = useState<number>(Number(bill.discount || 0));
  const [paymentMethod, setPaymentMethod] = useState<string>(bill.payment_method || 'Pay Later');
  const [cashPaid, setCashPaid] = useState<number>(Number(bill.cash_paid || 0));
  const [upiPaid, setUpiPaid] = useState<number>(Number(bill.upi_paid || 0));
  const [advanceUsed] = useState<number>(Number(bill.advance_used || 0));

  // Security & Audit
  const [reason, setReason] = useState<string>('');
  const [adminPin, setAdminPin] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Selected product to quickly add
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [prods, custs, stt] = await Promise.all([
          ApiService.getProducts(),
          ApiService.getCustomers(),
          ApiService.getSettings()
        ]);
        if (isMounted) {
          setProducts(prods || []);
          setCustomers(custs || []);
          setSettings(stt);
          setLoadingInitial(false);
        }
      } catch (err) {
        console.error('Failed to load products/customers for bill editing:', err);
        if (isMounted) setLoadingInitial(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  // Live Calculations
  const calculations = useMemo(() => {
    const subtotal = Number(items.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.price || 0)), 0).toFixed(2));
    const disc = Math.max(0, Number(discount || 0));
    const subtotalAfterDiscount = Math.max(0, subtotal - disc);

    let gstAmount = 0;
    if (settings?.billing?.gst_enabled && Number(settings.billing.gst_rate) > 0) {
      const rate = Number(settings.billing.gst_rate);
      gstAmount = Number(((subtotalAfterDiscount * rate) / 100).toFixed(2));
    }

    const preRoundTotal = subtotalAfterDiscount + gstAmount;
    const roundingMethod = (bill.rounding_method as RoundingMethod) || settings?.billing?.rounding_method || 'None';
    const { roundedTotal, roundingAdjustment } = ApiService.calculateRounding(preRoundTotal, roundingMethod);

    const totalPaid = Number((Number(cashPaid || 0) + Number(upiPaid || 0) + Number(advanceUsed || 0)).toFixed(2));
    const balanceDue = Math.max(0, Number((roundedTotal - totalPaid).toFixed(2)));

    return {
      subtotal,
      discount: disc,
      gstAmount,
      roundingAdjustment,
      grandTotal: roundedTotal,
      totalPaid,
      balanceDue
    };
  }, [items, discount, settings, bill.rounding_method, cashPaid, upiPaid, advanceUsed]);

  // Line Item Handlers
  const handleUpdateItem = (index: number, field: 'product_name' | 'quantity' | 'price', value: string | number) => {
    setItems(prev => {
      const updated = [...prev];
      const it = { ...updated[index] };
      if (field === 'product_name') {
        it.product_name = String(value);
      } else if (field === 'quantity') {
        it.quantity = Math.max(0.01, Number(value) || 0);
        it.total = Number((it.quantity * it.price).toFixed(2));
      } else if (field === 'price') {
        it.price = Math.max(0, Number(value) || 0);
        it.total = Number((it.quantity * it.price).toFixed(2));
      }
      updated[index] = it;
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setErrorMsg('A bill must contain at least one line item.');
      return;
    }
    setErrorMsg('');
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleAddProduct = () => {
    if (!selectedProductId) return;
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    setItems(prev => [
      ...prev,
      {
        product_id: prod.id,
        product_name: prod.name,
        quantity: 1,
        price: Number(prod.price || 0),
        total: Number(prod.price || 0)
      }
    ]);
    setSelectedProductId('');
  };

  const handleAddCustomItem = () => {
    setItems(prev => [
      ...prev,
      {
        product_id: null,
        product_name: 'Custom Service / Print',
        quantity: 1,
        price: 10,
        total: 10
      }
    ]);
  };

  const handleSelectPaymentMode = (mode: string) => {
    setPaymentMethod(mode);
    if (mode === 'Pay Later') {
      setCashPaid(0);
      setUpiPaid(0);
    } else if (mode === 'Cash') {
      const rem = Math.max(0, calculations.grandTotal - advanceUsed);
      setCashPaid(rem);
      setUpiPaid(0);
    } else if (mode === 'UPI') {
      const rem = Math.max(0, calculations.grandTotal - advanceUsed);
      setCashPaid(0);
      setUpiPaid(rem);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (items.length === 0) {
      setErrorMsg('Please add at least one line item.');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('Please enter a valid reason for updating this bill.');
      return;
    }

    const expectedPin = settings?.security?.super_admin_pin || '1234';
    if (adminPin.trim() !== expectedPin) {
      setErrorMsg('Invalid Super Admin Security PIN. Authorization required.');
      return;
    }

    setSubmitting(true);
    try {
      const updated = await ApiService.editFullBill(bill.id, {
        customer_id: customerId || null,
        items,
        discount: calculations.discount,
        rounding_method: (bill.rounding_method as RoundingMethod) || 'None',
        payment_method: paymentMethod,
        cash_paid: Number(cashPaid || 0),
        upi_paid: Number(upiPaid || 0),
        advance_used: advanceUsed,
        reason: reason.trim(),
        userName: 'Super Admin'
      });

      if (updated) {
        onSaved(updated);
        onClose();
      } else {
        setErrorMsg('Failed to update bill record.');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update bill');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-6 flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-400/30">
              <Receipt size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <span>Edit Bill</span>
                <span className="font-mono text-amber-400">#{bill.bill_number}</span>
              </h2>
              <p className="text-xs text-slate-400">
                Created on {new Date(bill.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* FEEDBACK ERROR */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-rose-800 text-xs">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* MODAL BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-slate-800">
          
          {/* 1. CUSTOMER SELECTION */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <User size={15} className="text-blue-600" />
              <span>Assigned Customer</span>
            </label>
            <div className="flex items-center gap-2">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Walk-in Customer (Unassigned)</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.mobile ? `(${c.mobile})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. LINE ITEMS EDITOR */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 font-mono">
                <Package size={15} className="text-blue-600" />
                <span>Line Items ({items.length})</span>
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium max-w-[200px]"
                >
                  <option value="">-- Add Store Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (₹{Number(p.price).toFixed(2)})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddProduct}
                  disabled={!selectedProductId}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomItem}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Custom Item</span>
                </button>
              </div>
            </div>

            {/* Table of items */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 w-24 text-right">Quantity</th>
                    <th className="py-2.5 px-3 w-28 text-right">Price (₹)</th>
                    <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>
                    <th className="py-2.5 px-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="p-2.5">
                        <input
                          type="text"
                          required
                          value={it.product_name}
                          onChange={(e) => handleUpdateItem(idx, 'product_name', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="any"
                          value={it.quantity}
                          onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-right font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          required
                          min="0"
                          step="any"
                          value={it.price}
                          onChange={(e) => handleUpdateItem(idx, 'price', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-right font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900 text-sm">
                        ₹{(it.quantity * it.price).toFixed(2)}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer"
                          title="Remove Item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. FINANCIAL SUMMARY CALCULATOR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            
            {/* Payment & Mode Section */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5 font-mono">
                <CreditCard size={15} className="text-emerald-600" />
                <span>Payment Settlement</span>
              </h4>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['Pay Later', 'Cash', 'UPI', 'Split Payment'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleSelectPaymentMode(mode)}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                        paymentMethod === mode
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Cash Paid (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashPaid || ''}
                    placeholder="0.00"
                    onChange={(e) => setCashPaid(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">UPI Paid (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={upiPaid || ''}
                    placeholder="0.00"
                    onChange={(e) => setUpiPaid(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {advanceUsed > 0 && (
                <div className="flex justify-between items-center text-xs text-teal-800 bg-teal-50 px-2.5 py-1.5 rounded-lg border border-teal-200 font-semibold">
                  <span>Advance Credit Applied:</span>
                  <span className="font-mono font-bold">₹{advanceUsed.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200">
                <span className="font-semibold text-slate-600">Remaining Balance Due:</span>
                <span className={`font-mono font-bold text-sm ${calculations.balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  ₹{calculations.balanceDue.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Totals & Discounts Section */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
              <h4 className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5 font-mono">
                <Calculator size={15} className="text-indigo-600" />
                <span>Invoice Breakdown</span>
              </h4>

              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Items Subtotal:</span>
                <span className="font-mono font-bold text-slate-800">₹{calculations.subtotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Discount Amount (₹):</span>
                <div className="w-28">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount || ''}
                    placeholder="0.00"
                    onChange={(e) => setDiscount(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-right font-mono font-bold"
                  />
                </div>
              </div>

              {calculations.gstAmount > 0 && (
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span>GST ({settings?.billing?.gst_rate}%):</span>
                  <span className="font-mono font-bold text-slate-800">₹{calculations.gstAmount.toFixed(2)}</span>
                </div>
              )}

              {calculations.roundingAdjustment !== 0 && (
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Rounding:</span>
                  <span className="font-mono font-bold">₹{calculations.roundingAdjustment.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-300 font-extrabold text-slate-900">
                <span>Grand Total:</span>
                <span className="font-mono text-base text-blue-700">₹{calculations.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 4. SUPER ADMIN AUTHORIZATION & REASON */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs uppercase tracking-wider font-mono">
              <ShieldAlert size={16} className="text-amber-600" />
              <span>Super Admin Audit & Authorization</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Reason for Bill Modification *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Corrected quantity from 9 to 5 per customer request"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Super Admin Security PIN *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="Enter Security PIN (Default: 1234)"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono pr-8 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <Lock size={14} className="absolute right-2.5 top-2.5 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex justify-end items-center space-x-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingInitial}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow transition flex items-center space-x-1.5 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving Updates...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Changes & Log Audit</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


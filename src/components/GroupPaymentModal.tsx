'use client';

import React, { useState, useEffect } from 'react';
import { GroupBill, Customer } from '@/lib/types';
import { ApiService } from '@/lib/services/api';
import { X, CheckCircle2, Users, IndianRupee } from 'lucide-react';

interface GroupPaymentModalProps {
  groupBill: GroupBill;
  onClose: () => void;
  onSuccess: () => void;
}

export function GroupPaymentModal({ groupBill, onClose, onSuccess }: GroupPaymentModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payingCustomerId, setPayingCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Advance'>('Cash');
  const [selectedBills, setSelectedBills] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const unpaidBills = (groupBill.bills || []).filter(
    (b) => b.status !== 'CANCELLED' && b.status !== 'VOID' && Number(b.grand_total || 0) - Number(b.paid_total || 0) > 0.01
  );

  useEffect(() => {
    ApiService.getCustomers().then((custs) => {
      setCustomers(custs);
      const firstUnpaidCust = unpaidBills.find((b) => b.customer_id)?.customer_id || custs[0]?.id || '';
      setPayingCustomerId(firstUnpaidCust);
    });
    // Pre-select first unpaid member share if only 1 unpaid, or leave unchecked for explicit choice
    if (unpaidBills.length === 1) {
      const b = unpaidBills[0];
      const due = Number((Number(b.grand_total || 0) - Number(b.paid_total || 0)).toFixed(2));
      setSelectedBills({ [b.id]: due });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBill.id]);

  const payingCustomer = customers.find((c) => c.id === payingCustomerId);
  const totalSelected = Number(
    Object.values(selectedBills)
      .reduce((s, v) => s + Number(v || 0), 0)
      .toFixed(2)
  );

  const toggleBill = (billId: string, remainingDue: number) => {
    setSelectedBills((prev) => {
      const next = { ...prev };
      if (billId in next) {
        delete next[billId];
      } else {
        next[billId] = remainingDue;
      }
      return next;
    });
  };

  const handleSelectAllUnpaid = () => {
    const all: Record<string, number> = {};
    unpaidBills.forEach((b) => {
      all[b.id] = Number((Number(b.grand_total || 0) - Number(b.paid_total || 0)).toFixed(2));
    });
    setSelectedBills(all);
  };

  const handleSelectSelfOnly = () => {
    if (!payingCustomerId) return;
    const selfBills: Record<string, number> = {};
    unpaidBills
      .filter((b) => b.customer_id === payingCustomerId)
      .forEach((b) => {
        selfBills[b.id] = Number((Number(b.grand_total || 0) - Number(b.paid_total || 0)).toFixed(2));
      });
    setSelectedBills(selfBills);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!payingCustomerId) {
      setErrorMsg('Please select the paying customer.');
      return;
    }
    const allocations = Object.entries(selectedBills)
      .map(([bill_id, amount]) => ({ bill_id, amount: Number(amount || 0) }))
      .filter((a) => a.amount > 0);
    if (allocations.length === 0) {
      setErrorMsg('Please select at least one member share to pay.');
      return;
    }

    setSubmitting(true);
    try {
      await ApiService.recordGroupBillPayment({
        group_bill_id: groupBill.id,
        paying_customer_id: payingCustomerId,
        payment_method: paymentMethod,
        allocations,
        notes: notes.trim() || undefined
      });
      onSuccess();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to record group payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Users size={20} className="text-emerald-400" />
            <div>
              <h3 className="font-bold text-base">Collect Group Bill Payment</h3>
              <p className="text-xs text-slate-400">{groupBill.group_bill_number} • Balance Due: ₹{Number(groupBill.balance_due || 0).toFixed(2)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Who is paying now?</label>
            <select
              value={payingCustomerId}
              onChange={(e) => setPayingCustomerId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900"
              required
            >
              <option value="">-- Select Paying Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.advance_balance > 0 ? ` (Advance: ₹${Number(c.advance_balance).toFixed(2)})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Select member shares being paid:</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectSelfOnly}
                  className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer"
                >
                  Self Only
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllUnpaid}
                  className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Select All Unpaid
                </button>
              </div>
            </div>

            {unpaidBills.length === 0 ? (
              <div className="p-4 text-center text-xs text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200 font-semibold">
                All member shares are fully paid!
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {unpaidBills.map((b) => {
                  const due = Number((Number(b.grand_total || 0) - Number(b.paid_total || 0)).toFixed(2));
                  const checked = b.id in selectedBills;
                  return (
                    <div
                      key={b.id}
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 transition ${
                        checked ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'
                      }`}
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleBill(b.id, due)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <div className="font-bold text-slate-900">{b.customer_name || 'Guest'}</div>
                          <div className="text-[11px] text-slate-500">
                            {b.bill_number} • Due: ₹{due.toFixed(2)}
                          </div>
                        </div>
                      </label>
                      {checked && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 font-bold">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={due}
                            value={selectedBills[b.id]}
                            onChange={(e) =>
                              setSelectedBills((prev) => ({
                                ...prev,
                                [b.id]: Math.min(due, Math.max(0, Number(e.target.value || 0)))
                              }))
                            }
                            className="w-20 bg-white border border-emerald-300 rounded px-2 py-1 text-right font-mono font-bold text-slate-900"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'Cash' | 'UPI' | 'Advance')}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                {payingCustomer && Number(payingCustomer.advance_balance || 0) > 0 && (
                  <option value="Advance">Advance (₹{Number(payingCustomer.advance_balance).toFixed(2)})</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Total Paying Now</label>
              <div className="w-full bg-slate-900 text-emerald-400 rounded-lg px-3 py-2 text-sm font-mono font-extrabold flex items-center gap-1">
                <IndianRupee size={14} />
                <span>{totalSelected.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Day 2 settlement"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || totalSelected <= 0}
              className="px-5 py-2 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg shadow flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>{submitting ? 'Recording...' : `Collect ₹${totalSelected.toFixed(2)}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


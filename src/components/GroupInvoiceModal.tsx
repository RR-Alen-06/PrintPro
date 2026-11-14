'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GroupBill, Bill, AllSettings } from '@/lib/types';
import { ApiService, DEFAULT_SETTINGS } from '@/lib/services/api';
import { 
  Printer, 
  X, 
  FileText, 
  Receipt, 
  Users, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { InvoiceModal } from './InvoiceModal';
import { GroupPaymentModal } from './GroupPaymentModal';

interface GroupInvoiceModalProps {
  groupBill: GroupBill | null;
  settings?: AllSettings;
  onClose: () => void;
  onCancelMemberBill?: (billId: string) => void;
  onPaymentRecorded?: () => void;
}

export function GroupInvoiceModal({ groupBill: propGroupBill, settings: propSettings, onClose, onCancelMemberBill, onPaymentRecorded }: GroupInvoiceModalProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'individual'>('summary');
  const [selectedIndividualBill, setSelectedIndividualBill] = useState<Bill | null>(null);
  const [showGroupPaymentModal, setShowGroupPaymentModal] = useState(false);
  const [localGroupBill, setLocalGroupBill] = useState<GroupBill | null>(propGroupBill);
  const [fetchedSettings, setFetchedSettings] = useState<AllSettings | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [showCancelPrompt, setShowCancelPrompt] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string>('');

  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalGroupBill(propGroupBill);
  }, [propGroupBill]);

  useEffect(() => {
    if (!propSettings) {
      ApiService.getSettings().then(s => {
        if (s) setFetchedSettings(s);
      }).catch(err => console.error('Failed to load settings:', err));
    }
  }, [propSettings]);

  const groupBill = localGroupBill || propGroupBill;
  if (!groupBill) return null;

  const activeSettings = propSettings || fetchedSettings || DEFAULT_SETTINGS;
  const shop = activeSettings.shop;
  const bills = groupBill.bills || [];

  const handlePrintSummary = () => {
    window.print();
  };

  const handleConfirmCancelMember = async (billId: string) => {
    if (!cancelReason.trim()) {
      setActionError('Please provide a reason for cancelling this member bill.');
      return;
    }
    setActionError('');
    setActionSuccess('');
    try {
      const res = await ApiService.cancelIndividualGroupMemberBill(billId, cancelReason.trim());
      if (res.success) {
        setActionSuccess(`Member bill cancelled successfully. Advance/payments have been reversed.`);
        setShowCancelPrompt(null);
        setCancelReason('');
        if (onCancelMemberBill) onCancelMemberBill(billId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel member bill';
      setActionError(msg);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:p-0 print:bg-white print:static">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800 print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight">{groupBill.group_bill_number}</h2>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                    groupBill.billing_type === 'SPLIT' 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {groupBill.billing_type === 'SPLIT' ? 'Split Billing' : 'Shared Billing'}
                  </span>
                  {groupBill.status === 'PARTIALLY_CANCELLED' && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium">
                      Partially Cancelled
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(groupBill.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} • {groupBill.participant_count} Participants
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {Number(groupBill.balance_due || 0) > 0.01 && (
                <button
                  onClick={() => setShowGroupPaymentModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all shadow-sm cursor-pointer"
                >
                  <span>Collect Payment</span>
                </button>
              )}
              <button
                onClick={handlePrintSummary}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Print Summary</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 px-6 pt-3 pb-2 bg-slate-50 border-b border-slate-200 print:hidden">
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'summary'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Group Summary Receipt</span>
            </button>
            <button
              onClick={() => setActiveTab('individual')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'individual'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Individual Receipts ({bills.length})</span>
            </button>
          </div>

          {/* Notifications */}
          {actionError && (
            <div className="mx-6 mt-3 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
              <span>{actionError}</span>
              <button onClick={() => setActionError('')} className="text-rose-500 hover:text-rose-700 font-bold">&times;</button>
            </div>
          )}
          {actionSuccess && (
            <div className="mx-6 mt-3 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center justify-between">
              <span>{actionSuccess}</span>
              <button onClick={() => setActionSuccess('')} className="text-emerald-500 hover:text-emerald-700 font-bold">&times;</button>
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'summary' ? (
              <div ref={summaryRef} className="max-w-2xl mx-auto bg-white p-6 rounded-xl border border-slate-200 print:border-none print:p-0">
                
                {/* Printable Receipt Header */}
                <div className="text-center pb-4 border-b border-dashed border-slate-300">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">{shop.shop_name || 'PrintPro Store'}</h1>
                  {shop.address && <p className="text-xs text-slate-600 mt-0.5">{shop.address}</p>}
                  {shop.phone && <p className="text-xs text-slate-600">Tel: {shop.phone}</p>}
                  {shop.gst_number && <p className="text-xs text-slate-600 font-mono mt-0.5">GSTIN: {shop.gst_number}</p>}
                  <div className="mt-3 inline-block px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold uppercase text-slate-700 tracking-wider">
                    {groupBill.billing_type === 'SPLIT' ? 'Split Billing Summary Receipt' : 'Shared Group Billing Receipt'}
                  </div>
                </div>

                {/* Group Details */}
                <div className="grid grid-cols-2 gap-3 py-3 text-xs border-b border-slate-200 text-slate-600">
                  <div>
                    <span className="text-slate-400 block">Group Order Ref</span>
                    <strong className="text-slate-900 font-mono text-sm">{groupBill.group_bill_number}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block">Date & Time</span>
                    <strong className="text-slate-900">{new Date(groupBill.created_at).toLocaleString('en-IN')}</strong>
                  </div>
                  {groupBill.notes && (
                    <div className="col-span-2 bg-slate-50 p-2 rounded-lg text-slate-700">
                      <strong>Remarks:</strong> {groupBill.notes}
                    </div>
                  )}
                </div>

                {/* Master Items (For Shared Billing) */}
                {groupBill.items && groupBill.items.length > 0 && (
                  <div className="py-4 border-b border-slate-200">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Combined Items Purchased</h3>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-semibold text-left">
                          <th className="pb-1.5">Item</th>
                          <th className="pb-1.5 text-center">Qty</th>
                          <th className="pb-1.5 text-right">Rate</th>
                          <th className="pb-1.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {groupBill.items.map((it, idx) => (
                          <tr key={it.id || idx}>
                            <td className="py-1.5 font-medium text-slate-800">{it.product_name}</td>
                            <td className="py-1.5 text-center text-slate-600">{it.quantity}</td>
                            <td className="py-1.5 text-right text-slate-600">₹{Number(it.price).toFixed(2)}</td>
                            <td className="py-1.5 text-right font-medium text-slate-900">₹{Number(it.total).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Participant Shares & Breakdowns */}
                <div className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Participants & Settlement</h3>
                    <span className="text-xs text-slate-500 font-medium">{bills.length} Customer Bills</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-semibold text-left">
                          <th className="pb-2">Participant</th>
                          <th className="pb-2 text-right">Share / Bill</th>
                          <th className="pb-2 text-right">Paid</th>
                          <th className="pb-2 text-right">Due</th>
                          <th className="pb-2 text-center">Mode</th>
                          <th className="pb-2 text-right print:hidden">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bills.map((b) => {
                          const isCancelled = b.status === 'CANCELLED';
                          const due = Math.max(0, Number(b.grand_total) - Number(b.paid_total));
                          return (
                            <tr key={b.id} className={isCancelled ? 'bg-rose-50/60 opacity-60' : 'hover:bg-slate-50'}>
                              <td className="py-2.5">
                                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                  <span>{b.customer_name || 'Walk-in Customer'}</span>
                                  {isCancelled && (
                                    <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 text-[10px] rounded font-medium">
                                      Void
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">{b.bill_number}</span>
                                {b.payment_method && b.payment_method.startsWith('Paid by') && (
                                  <span className="block text-[10px] text-indigo-600 font-medium">{b.payment_method}</span>
                                )}
                                {Number(b.loyalty_points_earned || 0) > 0 && (
                                  <span className="block text-[10px] text-amber-700 font-medium">
                                    🎁 +{b.loyalty_points_earned} Loyalty Pts
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 text-right font-medium text-slate-800">
                                ₹{Number(b.grand_total).toFixed(2)}
                              </td>
                              <td className="py-2.5 text-right font-medium text-emerald-700">
                                ₹{Number(b.paid_total).toFixed(2)}
                              </td>
                              <td className="py-2.5 text-right font-medium text-rose-600">
                                {due > 0.01 ? `₹${due.toFixed(2)}` : '—'}
                              </td>
                              <td className="py-2.5 text-center">
                                <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] rounded-md font-medium">
                                  {b.payment_method}
                                </span>
                              </td>
                              <td className="py-2.5 text-right print:hidden">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setSelectedIndividualBill(b)}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition-colors"
                                    title="View Individual Receipt"
                                  >
                                    View
                                  </button>
                                  {!isCancelled && (
                                    <button
                                      onClick={() => setShowCancelPrompt(b.id)}
                                      className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-[11px] font-medium transition-colors"
                                      title="Cancel only this member's bill"
                                    >
                                      Void
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Group Summary Totals */}
                <div className="pt-3 border-t-2 border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Order Subtotal</span>
                    <span className="font-medium text-slate-800">₹{Number(groupBill.total_amount).toFixed(2)}</span>
                  </div>
                  {Number(groupBill.discount) > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Group Discount</span>
                      <span>-₹{Number(groupBill.discount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                    <span>Grand Total</span>
                    <span>₹{Number(groupBill.grand_total).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-700 font-semibold">
                    <span>Total Settled / Paid</span>
                    <span>₹{Number(groupBill.paid_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-rose-600 font-semibold">
                    <span>Total Balance Due</span>
                    <span>₹{Number(groupBill.balance_due).toFixed(2)}</span>
                  </div>
                  {bills.reduce((sum, b) => sum + (b.status !== 'CANCELLED' ? Number(b.loyalty_points_earned || 0) : 0), 0) > 0 && (
                    <div className="flex justify-between text-xs text-amber-800 font-semibold bg-amber-50 px-2 py-1 rounded border border-amber-200 mt-1">
                      <span>🎁 Total Group Loyalty Points Awarded</span>
                      <span>+{bills.reduce((sum, b) => sum + (b.status !== 'CANCELLED' ? Number(b.loyalty_points_earned || 0) : 0), 0)} Pts</span>
                    </div>
                  )}
                </div>

                {/* Footer Note */}
                <div className="text-center pt-6 text-[11px] text-slate-400 border-t border-dashed border-slate-200 mt-6">
                  <p>{shop.footer_message || 'Thank you for your business!'}</p>
                  <p className="mt-0.5 text-[10px]">PrintPro Group Billing Management</p>
                </div>

              </div>
            ) : (
              /* Individual Receipts List */
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <p className="text-sm text-slate-600">
                    Select any participant below to view or print their dedicated individual receipt.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {bills.map((b) => (
                    <div
                      key={b.id}
                      className={`p-4 rounded-xl border transition-all ${
                        b.status === 'CANCELLED'
                          ? 'bg-rose-50/50 border-rose-200 opacity-70'
                          : 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{b.customer_name || 'Walk-in Customer'}</span>
                            {b.status === 'CANCELLED' && (
                              <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-bold">
                                Voided
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{b.bill_number}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-bold text-slate-900">₹{Number(b.grand_total).toFixed(2)}</span>
                          <span className="block text-[11px] font-medium text-emerald-700">Paid: ₹{Number(b.paid_total).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">Mode: {b.payment_method}</span>
                        <button
                          onClick={() => setSelectedIndividualBill(b)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>View Receipt</span>
                          <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 print:hidden">
            <span>Group Bill Reference: <strong className="text-slate-800 font-mono">{groupBill.group_bill_number}</strong></span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>

        </div>
      </div>

      {/* Cancel Individual Member Confirmation Modal */}
      {showCancelPrompt && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Cancel Individual Member Bill</h3>
                <p className="text-xs text-slate-500">Atomic Cancellation (Other members will remain active)</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Cancelling this member will immediately refund any used advance balance, mark their payment as void, reverse loyalty points, and update the group bill totals.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Cancellation Reason <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer cancelled order / Wrong entry"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowCancelPrompt(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={() => handleConfirmCancelMember(showCancelPrompt)}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Bill Inspector Modal */}
      {selectedIndividualBill && (
        <InvoiceModal
          bill={selectedIndividualBill}
          settings={activeSettings}
          onClose={() => setSelectedIndividualBill(null)}
        />
      )}

      {/* Group Bill Payment Modal */}
      {showGroupPaymentModal && (
        <GroupPaymentModal
          groupBill={groupBill}
          onClose={() => setShowGroupPaymentModal(false)}
          onSuccess={async () => {
            setShowGroupPaymentModal(false);
            const refreshed = await ApiService.getGroupBillById(groupBill.id);
            if (refreshed) setLocalGroupBill(refreshed);
            setActionSuccess('Group bill payment recorded successfully.');
            if (onPaymentRecorded) onPaymentRecorded();
          }}
        />
      )}
    </>
  );
}


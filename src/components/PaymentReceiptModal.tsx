'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Payment, CustomerSummary, AllSettings } from '@/lib/types';
import { ApiService, DEFAULT_SETTINGS } from '@/lib/services/api';
import { 
  Printer, 
  X, 
  MessageSquare, 
  Receipt
} from 'lucide-react';

interface PaymentReceiptModalProps {
  payment: Payment | null;
  customer?: CustomerSummary | null;
  settings?: AllSettings;
  onClose: () => void;
}

export function PaymentReceiptModal({
  payment,
  customer,
  settings: propSettings,
  onClose
}: PaymentReceiptModalProps) {
  const [settings, setSettings] = useState<AllSettings>(propSettings || DEFAULT_SETTINGS);
  const [customerDetails, setCustomerDetails] = useState<CustomerSummary | null>(customer || null);
  const voucherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!propSettings) {
      ApiService.getSettings().then(s => {
        if (s) setSettings(s);
      }).catch(console.error);
    }
  }, [propSettings]);

  useEffect(() => {
    if (payment?.customer_id && !customer) {
      ApiService.getCustomerSummaries().then(list => {
        const found = list.find(c => c.id === payment.customer_id);
        if (found) setCustomerDetails(found);
      }).catch(console.error);
    }
  }, [payment, customer]);

  if (!payment) return null;

  const notesText = payment.notes || '';
  
  // Extract allocation breakdown if present in notes
  const duesMatch = notesText.match(/Dues Settled:\s*₹?([\d.]+)/i);
  const advMatch = notesText.match(/Advance Credited:\s*₹?([\d.]+)/i);
  const standaloneAdvMatch = notesText.match(/Advance Payment:\s*₹?([\d.]+)/i);

  const duesSettledVal = duesMatch ? Number(duesMatch[1]) : 0;
  const advanceCreditedVal = advMatch ? Number(advMatch[1]) : (standaloneAdvMatch ? Number(standaloneAdvMatch[1]) : 0);
  const hasStructuredBreakdown = duesSettledVal > 0 || advanceCreditedVal > 0;

  const isCancelled = payment.status === 'CANCELLED';
  const isReversed = payment.status === 'REVERSED';
  const isInactive = isCancelled || isReversed;

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const custName = payment.customer_name || customerDetails?.name || 'Customer';
    const amountStr = Number(payment.amount).toFixed(2);
    const shopName = settings.shop.shop_name || 'Store';
    
    let msg = isInactive 
      ? `*[VOID / ${payment.status}] Payment Receipt - ${shopName}*\n`
      : `*Payment Receipt - ${shopName}*\n`;
    msg += `Receipt No: ${payment.payment_number || 'PAY'}\n`;
    msg += `Status: ${isInactive ? `CANCELLED / ${payment.status}` : 'ACTIVE'}\n`;
    msg += `Date: ${new Date(payment.created_at).toLocaleDateString('en-IN')}\n`;
    msg += `Customer: ${custName}\n`;
    msg += `Payment Mode: ${payment.payment_method}\n`;
    msg += `*Amount: ₹${amountStr}* ${isInactive ? '(VOID)' : ''}\n`;
    
    if (isInactive && payment.cancellation_reason) {
      msg += `Cancellation Reason: ${payment.cancellation_reason}\n`;
    }

    if (!isInactive && hasStructuredBreakdown) {
      if (duesSettledVal > 0) msg += `• Dues Cleared: ₹${duesSettledVal.toFixed(2)}\n`;
      if (advanceCreditedVal > 0) msg += `• Advance Credited: ₹${advanceCreditedVal.toFixed(2)}\n`;
    }

    if (customerDetails) {
      msg += `\n*Current Account Balance:*\n`;
      msg += `• Pending Dues: ₹${customerDetails.balance_due.toFixed(2)}\n`;
      msg += `• Advance Balance: ₹${customerDetails.advance_balance.toFixed(2)}\n`;
    }
    
    msg += `\n${isInactive ? 'Note: This payment receipt has been voided/cancelled.' : 'Thank you for your payment!'}`;

    const phone = payment.customer_mobile || customerDetails?.mobile;
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
    const waUrl = cleanPhone 
      ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="payment-receipt-modal-root fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:static print:bg-white print:backdrop-none">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 print:shadow-none print:m-0 print:border-none print:max-w-none print:w-full relative">
        
        {/* Modal Header */}
        <div className={`${isInactive ? 'bg-rose-950' : 'bg-slate-900'} text-white px-5 py-4 flex items-center justify-between transition-colors`}>
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${isInactive ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              <Receipt size={20} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base leading-tight">Payment Receipt Voucher</h3>
                {isInactive && (
                  <span className="bg-rose-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider">
                    {payment.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">{payment.payment_number || 'RECEIPT'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Inactive Alert Banner */}
        {isInactive && (
          <div className="bg-rose-50 border-b border-rose-200 px-5 py-2.5 flex items-center justify-between text-xs text-rose-800">
            <span className="font-bold uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <span>⚠️</span>
              <span>This Payment Voucher is Cancelled / Void</span>
            </span>
            {payment.cancelled_at && (
              <span className="text-[10px] text-rose-600 font-mono">
                {new Date(payment.cancelled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}

        {/* Printable Receipt Body */}
        <div className="p-6 space-y-5 print:p-0 relative overflow-hidden" ref={voucherRef}>
          
          {/* VOID WATERMARK OVERLAY */}
          {isInactive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 select-none opacity-20">
              <div className="border-8 border-rose-600 rounded-2xl px-8 py-4 rotate-[-28deg] text-center">
                <span className="font-black text-5xl sm:text-6xl text-rose-700 tracking-widest uppercase">
                  {payment.status === 'REVERSED' ? 'REVERSED' : 'VOID'}
                </span>
                <span className="block text-xs font-bold text-rose-800 tracking-wider mt-1">
                  PAYMENT REVERTED
                </span>
              </div>
            </div>
          )}

          {/* Shop Header */}
          <div className="text-center border-b border-slate-100 pb-4 space-y-1">
            <h2 className="font-extrabold text-lg text-slate-900 uppercase tracking-wide">
              {settings.shop.shop_name || 'SIMPLEBILLING STORE'}
            </h2>
            {settings.shop.address && (
              <p className="text-xs text-slate-500">{settings.shop.address}</p>
            )}
            <div className="text-[11px] text-slate-500 flex items-center justify-center space-x-3 font-medium">
              {settings.shop.phone && <span>Ph: {settings.shop.phone}</span>}
              {settings.shop.gst_number && <span>GSTIN: {settings.shop.gst_number}</span>}
            </div>
            <div className="pt-2">
              <span className={`inline-block text-[11px] font-extrabold uppercase px-3 py-1 rounded-full border ${
                isInactive 
                  ? 'bg-rose-100 text-rose-800 border-rose-300' 
                  : 'bg-slate-100 text-slate-800 border-slate-200'
              }`}>
                {isInactive ? `Voucher ${payment.status}` : 'Official Payment Voucher'}
              </span>
            </div>
          </div>

          {/* Transaction Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div>
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Receipt No:</span>
              <span className="font-mono font-bold text-slate-900 text-xs">{payment.payment_number || 'N/A'}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Date & Time:</span>
              <span className="font-semibold text-slate-700 text-xs">
                {new Date(payment.created_at).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Customer:</span>
              <span className="font-bold text-slate-900 text-xs">{payment.customer_name || customerDetails?.name || 'Customer'}</span>
              {(payment.customer_mobile || customerDetails?.mobile) && (
                <span className="text-[11px] text-slate-500 block font-mono">
                  {payment.customer_mobile || customerDetails?.mobile}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Payment Mode:</span>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                payment.payment_method === 'Cash'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-indigo-100 text-indigo-800'
              }`}>
                {payment.payment_method}
              </span>
            </div>
          </div>

          {/* Amount Paid Highlight */}
          <div className={`border rounded-xl p-4 flex items-center justify-between ${
            isInactive 
              ? 'bg-gradient-to-r from-rose-50 via-slate-50 to-rose-50 border-rose-200' 
              : 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-emerald-200'
          }`}>
            <div className="space-y-0.5">
              <span className={`text-xs font-bold uppercase ${isInactive ? 'text-rose-900' : 'text-emerald-900'}`}>
                {isInactive ? 'Cancelled Amount' : 'Total Amount Received'}
              </span>
              <p className={`text-[11px] ${isInactive ? 'text-rose-700 font-bold' : 'text-emerald-700'}`}>
                {isInactive ? 'Payment Reverted (Voided)' : 'Verified & Succeeded'}
              </p>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-black font-mono ${isInactive ? 'line-through text-slate-400' : 'text-emerald-700'}`}>
                ₹{Number(payment.amount).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Cancellation Details Callout (If Inactive) */}
          {isInactive && (
            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1 text-xs text-rose-900">
              <span className="font-bold text-[11px] uppercase tracking-wider block text-rose-950">
                Cancellation / Reversal Record
              </span>
              <p className="text-slate-700">
                <span className="font-semibold text-rose-900">Reason: </span>
                {payment.cancellation_reason || 'Reverted to unpaid'}
              </p>
              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 border-t border-rose-100">
                <span>By: <strong className="text-slate-700">{payment.cancelled_by || 'Admin'}</strong></span>
                {payment.cancelled_at && (
                  <span>On: {new Date(payment.cancelled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                )}
              </div>
            </div>
          )}

          {/* Allocation Breakdown (Dues vs Advance) */}
          {!isInactive && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                Payment Allocation Breakdown
              </h4>

              {hasStructuredBreakdown ? (
                <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-white">
                  {duesSettledVal > 0 && (
                    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                      <span className="text-slate-700 font-medium flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                        <span>Applied to Clear Bill Dues:</span>
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        ₹{duesSettledVal.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {advanceCreditedVal > 0 && (
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="text-slate-700 font-medium flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                        <span>Added to Customer Advance:</span>
                      </span>
                      <span className="font-bold text-indigo-700 font-mono">
                        +₹{advanceCreditedVal.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                  <span className="font-semibold block text-slate-800 mb-0.5">Payment Reference:</span>
                  <span>{payment.notes || 'Direct payment recorded towards customer ledger.'}</span>
                </div>
              )}
            </div>
          )}

          {/* Updated Customer Balances */}
          {customerDetails && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="border-r border-slate-200 pr-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining Due</span>
                <span className={`font-extrabold text-sm ${customerDetails.balance_due > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                  ₹{customerDetails.balance_due.toFixed(2)}
                </span>
              </div>
              <div className="pl-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Advance Balance</span>
                <span className="font-extrabold text-sm text-blue-700">
                  ₹{customerDetails.advance_balance.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="text-center pt-1">
            <p className="text-[10px] text-slate-400">
              {isInactive 
                ? 'VOID PAYMENT RECEIPT - NOT VALID FOR ACCOUNTING' 
                : `Generated digitally by ${settings.shop.shop_name || 'SimpleBilling'}. Valid payment voucher.`}
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
          >
            <MessageSquare size={15} />
            <span>WhatsApp</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Printer size={15} />
              <span>Print Voucher</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

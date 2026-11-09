'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ApiService } from '@/lib/services/api';
import { CustomerSummary, Payment, AllSettings } from '@/lib/types';
import { SupabaseBanner } from '@/components/SupabaseBanner';
import { PaymentReceiptModal } from '@/components/PaymentReceiptModal';
import { 
  CreditCard, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  Wallet, 
  BookOpen, 
  Receipt, 
  Clock, 
  History,
  Eye,
  Trash2,
  RefreshCw,
  X,
  ChevronDown,
  ArrowLeft,
  Lock
} from 'lucide-react';

function PaymentsContent() {
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get('customerId') || '';
  const returnTo = searchParams.get('returnTo');
  const billId = searchParams.get('billId');
  const billNumber = searchParams.get('billNumber');

  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId);
  const [loading, setLoading] = useState(true);

  // Form State
  const [cashAmount, setCashAmount] = useState<number | ''>('');
  const [upiAmount, setUpiAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  // Reversal / Delete Modal State
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletePin, setDeletePin] = useState('');
  const [override48h, setOverride48h] = useState(false);
  const [isDeletionPastLimit, setIsDeletionPastLimit] = useState(false);

  // Receipt Modal State
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<Payment | null>(null);

  // Custom Dropdown State
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerDropdownSearch, setCustomerDropdownSearch] = useState('');
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Feedback State
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentStatusTab, setPaymentStatusTab] = useState<'ALL' | 'ACTIVE' | 'REVERSED'>('ALL');
  const [showAllPayments, setShowAllPayments] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [custList, payList, settingsData] = await Promise.all([
        ApiService.getCustomerSummaries(),
        ApiService.getPayments(),
        ApiService.getSettings()
      ]);
      setCustomers(custList);
      setPayments(payList);
      setSettings(settingsData);
    } catch (err) {
      console.error('Failed to load payment data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDeletePayment = (payment: Payment) => {
    setDeletingPayment(payment);
    setDeleteReason('Accidental payment entry / payment not received');
    setDeletePin('');
    setOverride48h(false);
    const reversalWindowHours = Number(settings?.security?.payment_reversal_window_hours) || 72;
    // eslint-disable-next-line react-hooks/purity
    setIsDeletionPastLimit((Date.now() - new Date(payment.created_at).getTime()) > reversalWindowHours * 3600 * 1000);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleDeletePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!deletingPayment) return;

    if (!deleteReason.trim()) {
      setErrorMsg('Please state a reason for deleting/reversing this payment.');
      return;
    }

    const reversalWindowHours = Number(settings?.security?.payment_reversal_window_hours) || 72;
    const isPastLimit = (Date.now() - new Date(deletingPayment.created_at).getTime()) > reversalWindowHours * 3600 * 1000;
    if (isPastLimit && !override48h) {
      setErrorMsg(`This payment is older than ${reversalWindowHours} hours. Please check the Super Admin ${reversalWindowHours}-Hour Override box to proceed.`);
      return;
    }

    setSubmitting(true);
    try {
      await ApiService.deletePayment(
        deletingPayment.id,
        deleteReason.trim(),
        deletePin,
        'Super Admin',
        override48h
      );
      await ApiService.reconcileCustomerAdvanceBalances('Super Admin');
      setSuccessMsg(`Payment ${deletingPayment.payment_number || ''} (₹${deletingPayment.amount}) was deleted and customer ledger updated.`);
      setDeletingPayment(null);
      loadData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReconcileBalances = async () => {
    setReconciling(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await ApiService.reconcileCustomerAdvanceBalances('Super Admin');
      setSuccessMsg(`Reconciliation complete: checked ${res.customersReconciled} customers, fixed ${res.discrepanciesFixed} balance discrepancies.`);
      loadData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to reconcile balances');
    } finally {
      setReconciling(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
    }
  }, [initialCustomerId]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const cashVal = Number(cashAmount || 0);
  const upiVal = Number(upiAmount || 0);
  const totalEntered = cashVal + upiVal;

  // Live Allocation Calculations
  const currentBalanceDue = selectedCustomer ? Math.max(0, selectedCustomer.balance_due) : 0;
  const duesSettled = Math.min(currentBalanceDue, totalEntered);
  const advanceCredited = Math.max(0, totalEntered - currentBalanceDue);
  const remainingDueAfter = Math.max(0, currentBalanceDue - totalEntered);
  const newAdvanceBalance = selectedCustomer ? Number(selectedCustomer.advance_balance || 0) + advanceCredited : advanceCredited;

  const handleQuickFillDue = (mode: 'cash' | 'upi') => {
    if (!selectedCustomer) return;
    const due = Math.max(0, selectedCustomer.balance_due);
    if (mode === 'cash') {
      setCashAmount(due);
      setUpiAmount('');
    } else {
      setUpiAmount(due);
      setCashAmount('');
    }
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedCustomer) {
      setErrorMsg('Please select a customer.');
      return;
    }

    if (totalEntered <= 0) {
      setErrorMsg('Please enter a valid payment amount (Cash or UPI).');
      return;
    }

    setSubmitting(true);
    try {
      // Construct structured allocation note
      let allocNote = '';
      if (duesSettled > 0 && advanceCredited > 0) {
        allocNote = `[Dues Settled: ₹${duesSettled.toFixed(2)} | Advance Credited: ₹${advanceCredited.toFixed(2)}]`;
      } else if (advanceCredited > 0) {
        allocNote = `[Advance Credited: ₹${advanceCredited.toFixed(2)}]`;
      } else if (duesSettled > 0) {
        allocNote = `[Dues Settled: ₹${duesSettled.toFixed(2)}]`;
      }

      const combinedNotes = notes.trim() 
        ? `${notes.trim()} ${allocNote}` 
        : allocNote || 'Direct Payment Collection';

      let lastRecordedPayment: Payment | null = null;

      // Record Cash payment if entered
      if (cashVal > 0) {
        lastRecordedPayment = await ApiService.recordCustomerPayment({
          customer_id: selectedCustomer.id,
          amount: cashVal,
          payment_method: 'Cash',
          bill_id: billId || undefined,
          notes: combinedNotes
        });
      }

      // Record UPI payment if entered
      if (upiVal > 0) {
        lastRecordedPayment = await ApiService.recordCustomerPayment({
          customer_id: selectedCustomer.id,
          amount: upiVal,
          payment_method: 'UPI',
          bill_id: billId || undefined,
          notes: combinedNotes
        });
      }

      let msg = `Successfully collected ₹${totalEntered.toFixed(2)} from ${selectedCustomer.name}!`;
      if (duesSettled > 0 && advanceCredited > 0) {
        msg += ` (₹${duesSettled.toFixed(2)} Dues Cleared + ₹${advanceCredited.toFixed(2)} Advance Added)`;
      } else if (advanceCredited > 0) {
        msg += ` (+₹${advanceCredited.toFixed(2)} Added to Advance Balance)`;
      }
      setSuccessMsg(msg);
      
      setCashAmount('');
      setUpiAmount('');
      setNotes('');
      await loadData();

      // Automatically offer payment voucher
      if (lastRecordedPayment) {
        setSelectedPaymentForReceipt(lastRecordedPayment);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to collect payment');
    } finally {
      setSubmitting(false);
    }
  };

  // Customers with pending dues (and filtered for dropdown search)
  const dropdownFilteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerDropdownSearch.trim().toLowerCase()) ||
    (c.mobile && c.mobile.includes(customerDropdownSearch.trim()))
  );
  const customersWithDues = dropdownFilteredCustomers.filter(c => c.balance_due > 0);
  const otherDropdownCustomers = dropdownFilteredCustomers.filter(c => c.balance_due <= 0);

  // Counts
  const totalPaymentsCount = payments.length;
  const activePaymentsCount = payments.filter(p => p.status !== 'CANCELLED' && p.status !== 'REVERSED').length;
  const reversedPaymentsCount = payments.filter(p => p.status === 'CANCELLED' || p.status === 'REVERSED').length;

  // Filtered payments list
  const filteredPayments = payments.filter(p => {
    const isCancelled = p.status === 'CANCELLED';
    const isReversed = p.status === 'REVERSED';
    const isInactive = isCancelled || isReversed;

    if (paymentStatusTab === 'ACTIVE' && isInactive) return false;
    if (paymentStatusTab === 'REVERSED' && !isInactive) return false;

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (p.payment_number && p.payment_number.toLowerCase().includes(term)) ||
      (p.customer_name && p.customer_name.toLowerCase().includes(term)) ||
      (p.customer_mobile && p.customer_mobile.includes(term)) ||
      (p.bill_number && p.bill_number.toLowerCase().includes(term)) ||
      (p.payment_method && p.payment_method.toLowerCase().includes(term)) ||
      (p.notes && p.notes.toLowerCase().includes(term)) ||
      (p.cancellation_reason && p.cancellation_reason.toLowerCase().includes(term))
    );
  });

  const displayedPayments = showAllPayments ? filteredPayments : filteredPayments.slice(0, 30);

  return (
    <div className="space-y-6">
      <SupabaseBanner />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <CreditCard className="text-emerald-600" size={26} />
            <span>Payment Collection</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Collect dues, settle pending balances, or receive advance payments with automatic allocation
          </p>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-2">
          <button
            onClick={handleReconcileBalances}
            disabled={reconciling}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 cursor-pointer"
            title="Reconcile and sync customer advance balances with transaction records"
          >
            <RefreshCw size={14} className={reconciling ? 'animate-spin' : ''} />
            <span>{reconciling ? 'Reconciling...' : 'Reconcile Balances'}</span>
          </button>
          <Link
            href="/customers"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5"
          >
            <Users size={15} />
            <span>Customer Directory</span>
          </Link>
          <Link
            href="/bills"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5"
          >
            <Receipt size={15} />
            <span>Manage Bills</span>
          </Link>
        </div>
      </div>

      {/* Session Closing Due Clearance Notice */}
      {returnTo === 'accounting' && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-lg shrink-0 mt-0.5 sm:mt-0">
              <Lock size={16} />
            </div>
            <div>
              <p className="font-bold text-amber-950 text-sm">
                Session Closing Due Clearance
              </p>
              <p className="text-amber-800 mt-0.5">
                {selectedCustomer ? (
                  <>
                    Clearing pending due for <strong className="text-amber-950 font-bold">{selectedCustomer.name}</strong> {billNumber ? `(Bill #${billNumber})` : ''}.
                    Enter received Cash or UPI below to settle dues before completing your accounting session.
                  </>
                ) : (
                  <>
                    Select the customer below to collect payment and clear dues before completing your accounting session.
                  </>
                )}
              </p>
            </div>
          </div>
          <Link
            href="/accounting?reopenClose=true"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 font-bold rounded-lg text-xs shrink-0 transition shadow-2xs"
          >
            <ArrowLeft size={14} />
            <span>Return to Accounting</span>
          </Link>
        </div>
      )}

      {/* Status Alerts */}
      {errorMsg && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-lg flex items-center space-x-2 text-rose-800 text-xs font-medium">
          <AlertTriangle size={16} className="text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-800 text-xs font-medium">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          {returnTo === 'accounting' && (
            <Link
              href="/accounting?reopenClose=true"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shrink-0 transition shadow-xs"
            >
              <span>Return to Session Closing →</span>
            </Link>
          )}
        </div>
      )}

      {/* MAIN TWO COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: COLLECTION FORM (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-2 flex items-center space-x-2">
              <Wallet className="text-blue-600" size={18} />
              <span>Collect Customer Payment</span>
            </h2>

            <form onSubmit={handleCollectPayment} className="space-y-4">
              {/* Customer Selector */}
              <div className="relative" ref={customerDropdownRef}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Customer *
                </label>
                <div className="relative w-full">
                  <button
                    type="button"
                    onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none flex items-center justify-between cursor-pointer transition text-left"
                  >
                    <span className={selectedCustomer ? 'text-slate-900 font-bold truncate' : 'text-slate-500 font-normal'}>
                      {selectedCustomer 
                        ? `${selectedCustomer.name} ${selectedCustomer.mobile ? `(${selectedCustomer.mobile})` : ''} ${selectedCustomer.balance_due > 0 ? `— Due: ₹${selectedCustomer.balance_due.toFixed(2)}` : ''}` 
                        : '-- Choose Customer --'}
                    </span>
                    <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 flex-shrink-0 ml-2 ${customerDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {customerDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-100">
                      <div className="sticky top-0 bg-white p-2 border-b border-slate-100 z-10">
                        <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5">
                          <Search size={14} className="text-slate-400 shrink-0" />
                          <input
                            type="text"
                            autoFocus
                            placeholder="Search customer name or mobile..."
                            value={customerDropdownSearch}
                            onChange={(e) => setCustomerDropdownSearch(e.target.value)}
                            className="w-full bg-transparent text-xs text-slate-800 focus:outline-none"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId('');
                          setCustomerDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 font-medium transition cursor-pointer"
                      >
                        -- Choose Customer --
                      </button>

                      {dropdownFilteredCustomers.length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-500">
                          No customer matching &ldquo;{customerDropdownSearch}&rdquo;.
                        </div>
                      )}

                      {customersWithDues.length > 0 && (
                        <div>
                          <div className="bg-amber-50/80 px-3 py-1 text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                            ⚠️ Customers With Pending Dues
                          </div>
                          {customersWithDues.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomerId(c.id);
                                setCustomerDropdownOpen(false);
                                setCustomerDropdownSearch('');
                              }}
                              className={`w-full text-left px-3 py-2.5 text-xs transition flex items-center justify-between cursor-pointer ${
                                selectedCustomerId === c.id
                                  ? 'bg-blue-50 text-blue-900 font-bold'
                                  : 'text-slate-800 hover:bg-slate-50'
                              }`}
                            >
                              <span className="truncate">{c.name} {c.mobile ? `(${c.mobile})` : ''}</span>
                              <span className="text-[11px] font-mono font-bold text-amber-700 ml-2 flex-shrink-0">
                                Due: ₹{c.balance_due.toFixed(2)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {otherDropdownCustomers.length > 0 && (
                        <div>
                          <div className="bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                            All Other Customers
                          </div>
                          {otherDropdownCustomers.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomerId(c.id);
                                setCustomerDropdownOpen(false);
                                setCustomerDropdownSearch('');
                              }}
                              className={`w-full text-left px-3 py-2.5 text-xs transition flex items-center justify-between cursor-pointer ${
                                selectedCustomerId === c.id
                                  ? 'bg-blue-50 text-blue-900 font-bold'
                                  : 'text-slate-800 hover:bg-slate-50'
                              }`}
                            >
                              <span className="truncate">{c.name} {c.mobile ? `(${c.mobile})` : ''}</span>
                              {c.advance_balance > 0 && (
                                <span className="text-[10px] font-mono font-bold text-blue-700 ml-2 flex-shrink-0">
                                  Adv: ₹{c.advance_balance.toFixed(2)}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Balance Summary Card */}
              {selectedCustomer && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                    <span className="font-bold text-slate-900 text-sm">{selectedCustomer.name}</span>
                    <Link
                      href={`/customers/${selectedCustomer.id}`}
                      className="text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1"
                    >
                      <BookOpen size={12} />
                      <span>View Full Ledger</span>
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Total Billed:</span>
                      <span className="font-bold text-slate-800">₹{selectedCustomer.total_billed.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total Paid:</span>
                      <span className="font-bold text-emerald-700">₹{selectedCustomer.total_paid.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Current Balance Due:</span>
                      <span className={`font-extrabold text-sm ${selectedCustomer.balance_due > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                        ₹{selectedCustomer.balance_due.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Customer Advance:</span>
                      <span className="font-bold text-blue-700">₹{selectedCustomer.advance_balance.toFixed(2)}</span>
                    </div>
                  </div>

                  {selectedCustomer.balance_due > 0 && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Quick Settle:</span>
                      <button
                        type="button"
                        onClick={() => handleQuickFillDue('cash')}
                        className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px] transition cursor-pointer"
                      >
                        ⚡ Settle Cash (₹{selectedCustomer.balance_due.toFixed(2)})
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickFillDue('upi')}
                        className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-bold px-2 py-0.5 rounded text-[10px] transition cursor-pointer"
                      >
                        ⚡ Settle UPI (₹{selectedCustomer.balance_due.toFixed(2)})
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Split Inputs */}
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cash Received (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      UPI Received (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={upiAmount}
                      onChange={(e) => setUpiAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Total Payment Feedback */}
                <div className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <span className="font-semibold text-slate-700">Total Payment Entered:</span>
                  <span className="font-extrabold text-slate-900 text-base font-mono">₹{totalEntered.toFixed(2)}</span>
                </div>

                {/* LIVE PAYMENT ALLOCATION PREVIEW CARD */}
                {selectedCustomer && totalEntered > 0 && (
                  <div className="bg-gradient-to-br from-purple-50/70 via-indigo-50/50 to-blue-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-2.5 text-xs animate-in fade-in duration-150">
                    <div className="flex items-center justify-between border-b border-indigo-100 pb-1.5">
                      <span className="font-bold text-indigo-950 uppercase tracking-wider text-[10px] flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block animate-pulse"></span>
                        <span>Live Allocation Breakdown</span>
                      </span>
                      <span className="font-extrabold text-indigo-900 font-mono text-xs">
                        ₹{totalEntered.toFixed(2)} Received
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {/* Case 1: Dues Settled */}
                      <div className="flex justify-between items-center bg-white/90 px-2.5 py-1.5 rounded-lg border border-slate-200/70">
                        <span className="text-slate-700 font-medium flex items-center space-x-1.5">
                          <span className={`w-2 h-2 rounded-full ${duesSettled > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                          <span>Applied to Clear Bill Dues:</span>
                        </span>
                        <span className="font-bold text-emerald-700 font-mono">
                          ₹{duesSettled.toFixed(2)}
                        </span>
                      </div>

                      {/* Case 2: Advance Credited (Excess Payment) */}
                      {advanceCredited > 0 && (
                        <div className="flex justify-between items-center bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-200">
                          <span className="text-indigo-900 font-bold flex items-center space-x-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                            <span>Added to Customer Advance:</span>
                          </span>
                          <span className="font-extrabold text-indigo-700 font-mono">
                            +₹{advanceCredited.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Resulting Ledger Projection */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-indigo-100/80 text-[11px] text-center">
                      <div className="bg-white/90 p-1.5 rounded-lg border border-slate-200/70">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">New Due Balance</span>
                        <span className={`font-extrabold ${remainingDueAfter > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                          ₹{remainingDueAfter.toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-white/90 p-1.5 rounded-lg border border-slate-200/70">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">New Advance Balance</span>
                        <span className="font-extrabold text-indigo-700">
                          ₹{newAdvanceBalance.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Notes / Payment Reference (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GPay ref #123456 or Advance payment"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || totalEntered <= 0 || !selectedCustomerId}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-lg shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <CheckCircle2 size={18} />
                  <span>{submitting ? 'Recording Payment...' : `Record Payment (₹${totalEntered.toFixed(2)})`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: RECENT PAYMENTS LOG & PENDING CUSTOMERS (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <History className="text-slate-600" size={20} />
                <h2 className="text-base font-bold text-slate-900">Recent Payment Transactions</h2>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search receipt, customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 w-48 sm:w-56"
                />
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-2">
              <button
                type="button"
                onClick={() => setPaymentStatusTab('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                  paymentStatusTab === 'ALL'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>All Receipts</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${paymentStatusTab === 'ALL' ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'}`}>
                  {totalPaymentsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentStatusTab('ACTIVE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                  paymentStatusTab === 'ACTIVE'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                <span>Active</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${paymentStatusTab === 'ACTIVE' ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-200 text-emerald-800'}`}>
                  {activePaymentsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentStatusTab('REVERSED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                  paymentStatusTab === 'REVERSED'
                    ? 'bg-rose-700 text-white shadow-sm'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                <span>Reversed / Cancelled</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${paymentStatusTab === 'REVERSED' ? 'bg-rose-800 text-rose-100' : 'bg-rose-200 text-rose-800'}`}>
                  {reversedPaymentsCount}
                </span>
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 text-xs">Loading transaction history...</div>
            ) : filteredPayments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Clock className="mx-auto text-slate-300 mb-2" size={32} />
                <p>No payment records found.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200 text-[11px]">
                      <th className="py-2.5 px-3">Receipt / Payment ID</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Linked Ref</th>
                      <th className="py-2.5 px-3">Mode</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                      <th className="py-2.5 px-3 text-center w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedPayments.map((pay) => {
                      const isCancelled = pay.status === 'CANCELLED';
                      const isReversed = pay.status === 'REVERSED';
                      const isInactive = isCancelled || isReversed;

                      const hasAdv = pay.notes?.includes('Advance Credited') || pay.notes?.includes('Advance Payment');
                      const hasDues = pay.notes?.includes('Dues Settled');

                      return (
                        <tr key={pay.id} className={`hover:bg-slate-50/80 transition ${isInactive ? 'bg-rose-50/20' : ''}`}>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            <span className={isInactive ? 'line-through text-slate-400 font-normal' : 'text-slate-900'}>
                              {pay.payment_number || 'PAY-N/A'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-data-mono">
                            {new Date(pay.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800 block">{pay.customer_name || 'Customer'}</span>
                            {pay.customer_mobile && (
                              <span className="text-[10px] text-slate-400 font-mono block">{pay.customer_mobile}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {pay.bill_number ? (
                              <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                                {pay.bill_number}
                              </span>
                            ) : hasAdv ? (
                              <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] font-bold border border-indigo-100">
                                Advance
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Direct</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              pay.payment_method === 'Cash'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}>
                              {pay.payment_method}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isCancelled ? (
                              <span className="inline-block bg-rose-100 text-rose-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-rose-200 uppercase" title={`Reason: ${pay.cancellation_reason || 'Cancelled'}`}>
                                Cancelled
                              </span>
                            ) : isReversed ? (
                              <span className="inline-block bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-200 uppercase" title={`Reason: ${pay.cancellation_reason || 'Reversed with Bill'}`}>
                                Reversed
                              </span>
                            ) : (
                              <span className="inline-block bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-200 uppercase">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className={`font-extrabold font-mono block ${isInactive ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                              ₹{Number(pay.amount).toFixed(2)}
                            </span>
                            {hasAdv && !isInactive && (
                              <span className="inline-block bg-indigo-50 text-indigo-700 text-[9px] font-bold px-1.5 py-0.2 rounded border border-indigo-100">
                                Advance
                              </span>
                            )}
                            {hasDues && !hasAdv && !isInactive && (
                              <span className="inline-block bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.2 rounded border border-emerald-100">
                                Dues Settled
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedPaymentForReceipt(pay)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title="View Payment Voucher Receipt"
                              >
                                <Eye size={15} />
                              </button>
                              {!isInactive ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDeletePayment(pay)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Super Admin: Delete / Reverse Payment Entry"
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : (
                                <span className="p-1.5 text-slate-300 cursor-not-allowed" title={`Already ${isCancelled ? 'Cancelled' : 'Reversed'}: ${pay.cancellation_reason || ''}`}>
                                  <Trash2 size={14} />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

                {filteredPayments.length > 0 && (
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                    <span>
                      Showing <strong className="text-slate-900 font-mono">{displayedPayments.length}</strong> of <strong className="text-slate-900 font-mono">{filteredPayments.length}</strong> payment transactions
                    </span>
                    {filteredPayments.length > 30 && (
                      <button
                        type="button"
                        onClick={() => setShowAllPayments(!showAllPayments)}
                        className="font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                      >
                        {showAllPayments ? 'Show Compact (30)' : `Show All (${filteredPayments.length})`}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* DELETE / REVERSE PAYMENT MODAL */}
      {deletingPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-rose-700 flex items-center space-x-2">
                <Trash2 className="text-rose-600" size={20} />
                <span>Delete Payment ({deletingPayment.payment_number || 'PAY'})</span>
              </h2>
              <button onClick={() => setDeletingPayment(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-r-lg space-y-1 text-xs text-rose-800">
              <span className="font-bold block">Payment Deletion Notice</span>
              <p>Deleting this payment entry will restore the customer&apos;s pending balance due (or deduct any advance that was credited) and update all financial reports accordingly.</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold text-slate-800">{deletingPayment.customer_name || 'Customer'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Mode:</span>
                <span className="font-bold text-slate-800">{deletingPayment.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount to Delete:</span>
                <span className="font-mono font-extrabold text-rose-700">₹{Number(deletingPayment.amount).toFixed(2)}</span>
              </div>
            </div>

            {/* REVERSAL / DELETION LIMIT WARNING & OVERRIDE */}
            {deletingPayment && isDeletionPastLimit && (
              <div className="space-y-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs">
                <div className="flex items-start space-x-2">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">{Number(settings?.security?.payment_reversal_window_hours) || 72}-Hour Deletion Window Exceeded</span>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      This payment was recorded on {new Date(deletingPayment.created_at).toLocaleString('en-IN')}. Super Admin override is mandatory to cancel past {Number(settings?.security?.payment_reversal_window_hours) || 72} hours.
                    </p>
                  </div>
                </div>

                <label className="flex items-center space-x-2 pt-1 border-t border-amber-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={override48h}
                    onChange={(e) => setOverride48h(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                  />
                  <span className="font-bold text-[11px] text-amber-950">
                    I confirm Super Admin Override for payment older than {Number(settings?.security?.payment_reversal_window_hours) || 72} hours
                  </span>
                </label>
              </div>
            )}

            <form onSubmit={handleDeletePaymentSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Deletion *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Accidental entry / money not received"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Super Admin Security PIN *</label>
                <input
                  type="password"
                  required
                  placeholder="PIN (Default: 1234)"
                  value={deletePin}
                  onChange={(e) => setDeletePin(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletingPayment(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-extrabold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                >
                  <Trash2 size={14} className={submitting ? 'animate-spin' : ''} />
                  <span>{submitting ? 'Deleting...' : 'Delete Payment Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Receipt Modal */}
      {selectedPaymentForReceipt && (
        <PaymentReceiptModal
          payment={selectedPaymentForReceipt}
          onClose={() => setSelectedPaymentForReceipt(null)}
        />
      )}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 text-xs">Loading payment module...</div>}>
      <PaymentsContent />
    </Suspense>
  );
}


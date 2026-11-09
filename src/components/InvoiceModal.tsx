'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bill, BillItem, BillFinancialSummary, AllSettings } from '@/lib/types';
import { ApiService, DEFAULT_SETTINGS } from '@/lib/services/api';
import { 
  Printer, 
  X, 
  FileText, 
  Receipt, 
  CheckCircle2, 
  MessageSquare, 
  Download, 
  Mail, 
  Share2, 
  Send, 
  ChevronDown, 
  Loader2
} from 'lucide-react';
import { InvoicePdfGenerator } from '@/lib/services/invoicePdfGenerator';
import { jsPDF } from 'jspdf';

interface InvoiceModalProps {
  bill: Bill | null;
  settings?: AllSettings;
  customerEmail?: string;
  onClose: () => void;
}

export function InvoiceModal({ bill, settings: propSettings, customerEmail: propEmail, onClose }: InvoiceModalProps) {
  const [printFormat, setPrintFormat] = useState<'thermal-80' | 'thermal-58' | 'a4'>('thermal-80');
  const [fetchedSummary, setFetchedSummary] = useState<BillFinancialSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [fetchedSettings, setFetchedSettings] = useState<AllSettings | null>(null);
  
  // PDF download & Email states
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const invoiceRef = useRef<HTMLDivElement>(null);
  const shareDropdownRef = useRef<HTMLDivElement>(null);

  // Load settings if not passed as prop
  useEffect(() => {
    if (!propSettings) {
      ApiService.getSettings().then(s => {
        if (s) setFetchedSettings(s);
      }).catch(err => console.error('Failed to load settings in InvoiceModal:', err));
    }
  }, [propSettings]);

  // Load financial summary asynchronously only if not present on bill
  useEffect(() => {
    let active = true;
    if (bill && !bill.financial_summary) {
      setLoadingSummary(true);
      ApiService.getBillFinancialSummary(bill).then(summary => {
        if (active) {
          setFetchedSummary(summary);
          setLoadingSummary(false);
        }
      }).catch(err => {
        console.error('Failed to fetch bill financial summary:', err);
        if (active) setLoadingSummary(false);
      });
    }
    return () => { active = false; };
  }, [bill]);

  // Close share dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareDropdownRef.current && !shareDropdownRef.current.contains(event.target as Node)) {
        setShareMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear toast after 4s
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  if (!bill) return null;

  const activeSettings = propSettings || fetchedSettings || DEFAULT_SETTINGS;
  const shop = activeSettings.shop;
  const billingConfig = activeSettings.billing;
  const waConfig = activeSettings.whatsapp;

  const rawCust = (bill as unknown as Record<string, unknown>).customers;
  const custObj = (Array.isArray(rawCust) ? rawCust[0] : rawCust) as { name?: string; mobile?: string; email?: string } | undefined;
  const customerName = bill.customer_name || custObj?.name || (bill.customer_id ? 'Customer' : 'Walk-in Customer');
  const customerMobile = bill.customer_mobile || custObj?.mobile || null;
  const customerEmail = propEmail || bill.customer_email || custObj?.email || undefined;
  const billItems: BillItem[] = (bill.items && bill.items.length > 0) ? bill.items : (((bill as unknown as Record<string, unknown>).bill_items as BillItem[]) || []);

  const formattedDate = bill.created_at 
    ? new Date(bill.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  const subTotal = Number(bill.total || 0);
  const discountVal = Number(bill.discount || 0);
  const gstAmount = Number(bill.gst_amount || 0);
  const roundingAdj = Number(bill.rounding_adjustment || 0);
  const grandTotalVal = Number(bill.grand_total || 0);

  const summary = bill.financial_summary || fetchedSummary || {
    previous_outstanding: 0,
    previous_advance: 0,
    current_bill_amount: grandTotalVal,
    total_amount_due: grandTotalVal,
    cash_paid: Number(bill.cash_paid || 0),
    upi_paid: Number(bill.upi_paid || 0),
    advance_used: Number(bill.advance_used || 0),
    total_paid: Number(bill.paid_total || 0),
    remaining_balance: Math.max(0, grandTotalVal - Number(bill.paid_total || 0)),
    remaining_advance_balance: Number(bill.advance_earned || 0),
    payment_status: (Math.max(0, grandTotalVal - Number(bill.paid_total || 0)) === 0 ? 'Fully Paid' : 'Payment Pending') as 'Fully Paid' | 'Payment Pending'
  };

  const isPending = summary.remaining_balance > 0;

  const handlePrint = () => {
    document.documentElement.dataset.printFormat = printFormat;
    window.print();
  };

  const generatePdfInstance = async (): Promise<{ pdf: jsPDF; filename: string } | null> => {
    try {
      return InvoicePdfGenerator.generateInvoicePdf(bill, summary, shop, printFormat);
    } catch (err) {
      console.error('Vector PDF generation error:', err);
      return null;
    }
  };

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true);
    try {
      const result = await generatePdfInstance();
      if (result) {
        result.pdf.save(result.filename);
        setToastMsg({ text: `Downloaded ${result.filename}`, type: 'success' });
      }
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      setToastMsg({ text: 'Failed to generate PDF file.', type: 'error' });
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleShareWhatsAppText = () => {
    const text = ApiService.generateDigitalReceiptText(bill, summary, shop);
    const encoded = encodeURIComponent(text);
    const phone = bill.customer_mobile ? bill.customer_mobile.replace(/[^0-9]/g, '') : '';
    const url = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
    setShareMenuOpen(false);
  };

  const handleShareTelegram = () => {
    const text = ApiService.generateDigitalReceiptText(bill, summary, shop);
    const url = `https://t.me/share/url?url=${encodeURIComponent('')}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setShareMenuOpen(false);
  };

  const handleShareSMS = () => {
    const text = ApiService.generateDigitalReceiptText(bill, summary, shop);
    const phone = bill.customer_mobile ? bill.customer_mobile.replace(/[^0-9]/g, '') : '';
    const url = `sms:${phone}?body=${encodeURIComponent(text)}`;
    window.open(url);
    setShareMenuOpen(false);
  };

  const handleNativeShare = async () => {
    setShareMenuOpen(false);
    const text = ApiService.generateDigitalReceiptText(bill, summary, shop);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Bill ${bill.bill_number} - ${shop.shop_name || 'Store'}`,
          text: text
        });
        setToastMsg({ text: 'Shared successfully!', type: 'success' });
      } catch {
        // User cancelled or share failed
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setToastMsg({ text: 'Receipt text copied to clipboard!', type: 'info' });
    }
  };

  const handleShareEmail = async () => {
    setShareMenuOpen(false);
    if (!customerEmail) {
      setToastMsg({ text: 'No customer email on file — add one in Customers directory', type: 'error' });
      return;
    }

    setSendingEmail(true);
    try {
      const result = await generatePdfInstance();
      if (!result) throw new Error('Could not generate PDF attachment');

      const pdfBase64 = result.pdf.output('datauristring');
      const emailHtml = ApiService.generateEmailHtmlReceipt(bill, summary, shop);
      const emailText = ApiService.generateDigitalReceiptText(bill, summary, shop);

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email: customerEmail,
          bill_number: bill.bill_number,
          customer_name: bill.customer_name || 'Valued Customer',
          grand_total: bill.grand_total,
          shop_name: shop.shop_name || 'Store',
          message_html: emailHtml,
          message_text: emailText,
          pdf_attachment: pdfBase64,
          customServiceId: waConfig.email_service_id,
          customTemplateId: waConfig.email_template_id,
          customPublicKey: waConfig.email_public_key,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to dispatch email');
      }

      setToastMsg({ text: `Email with PDF & full invoice sent to ${customerEmail}!`, type: 'success' });
    } catch (err: unknown) {
      console.error('Email send error:', err);
      setToastMsg({ 
        text: err instanceof Error ? err.message : 'Failed to send email. Check Email credentials.', 
        type: 'error' 
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="invoice-modal-root fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:static print:bg-white print:backdrop-none">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden my-8 print:shadow-none print:m-0 print:max-w-none print:w-full">
        
        {/* Modal Toolbar (Hidden during print) */}
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="text-emerald-400" size={20} />
            <span className="font-bold text-base sm:text-lg">Bill Saved & Receipt Ready</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Format Toggle */}
            <div className="bg-slate-800 p-1 rounded-lg flex items-center space-x-1 border border-slate-700">
              <button
                type="button"
                onClick={() => setPrintFormat('thermal-80')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                  printFormat === 'thermal-80'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Receipt size={14} />
                <span>Thermal 80mm</span>
              </button>

              <button
                type="button"
                onClick={() => setPrintFormat('thermal-58')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                  printFormat === 'thermal-58'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Receipt size={14} />
                <span>Thermal 58mm</span>
              </button>

              <button
                type="button"
                onClick={() => setPrintFormat('a4')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                  printFormat === 'a4'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileText size={14} />
                <span>A4 Invoice</span>
              </button>
            </div>

            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPDF}
              disabled={downloadingPDF}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 shadow transition"
              title="Download Real PDF File"
            >
              {downloadingPDF ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            {/* Share Dropdown Button */}
            <div className="relative" ref={shareDropdownRef}>
              <button
                onClick={() => setShareMenuOpen(!shareMenuOpen)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 shadow transition"
                title="Share Invoice"
              >
                <Share2 size={14} />
                <span>Share</span>
                <ChevronDown size={13} className={`transition-transform ${shareMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {shareMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1.5 z-50 text-xs text-slate-200">
                  {/* WhatsApp */}
                  <button
                    onClick={handleShareWhatsAppText}
                    className="w-full px-3.5 py-2 text-left hover:bg-slate-700/80 flex items-center space-x-2.5 text-emerald-400 font-semibold transition"
                  >
                    <MessageSquare size={15} />
                    <span>WhatsApp (Text)</span>
                  </button>

                  {/* Email with PDF */}
                  <button
                    onClick={handleShareEmail}
                    disabled={sendingEmail}
                    className="w-full px-3.5 py-2 text-left hover:bg-slate-700/80 flex items-center space-x-2.5 text-blue-400 font-semibold transition disabled:opacity-50"
                  >
                    {sendingEmail ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                    <span>Email PDF Attachment</span>
                  </button>

                  {/* Telegram */}
                  <button
                    onClick={handleShareTelegram}
                    className="w-full px-3.5 py-2 text-left hover:bg-slate-700/80 flex items-center space-x-2.5 text-sky-400 font-semibold transition"
                  >
                    <Send size={15} />
                    <span>Telegram</span>
                  </button>

                  {/* SMS */}
                  <button
                    onClick={handleShareSMS}
                    className="w-full px-3.5 py-2 text-left hover:bg-slate-700/80 flex items-center space-x-2.5 text-amber-400 font-semibold transition"
                  >
                    <MessageSquare size={15} />
                    <span>SMS</span>
                  </button>

                  <div className="border-t border-slate-700 my-1"></div>

                  {/* Native Web Share */}
                  <button
                    onClick={handleNativeShare}
                    className="w-full px-3.5 py-2 text-left hover:bg-slate-700/80 flex items-center space-x-2.5 text-slate-300 font-semibold transition"
                  >
                    <Share2 size={15} />
                    <span>More Options / Copy</span>
                  </button>
                </div>
              )}
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 shadow transition"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMsg && (
          <div className={`px-6 py-2 text-xs font-semibold flex items-center justify-between print:hidden ${
            toastMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' :
            toastMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border-b border-rose-200' :
            'bg-blue-50 text-blue-800 border-b border-blue-200'
          }`}>
            <span>{toastMsg.text}</span>
            <button onClick={() => setToastMsg(null)} className="text-slate-500 hover:text-slate-700 ml-2">×</button>
          </div>
        )}

        {/* PRINT CONTAINER */}
        <div className="p-6 overflow-y-auto max-h-[80vh] print:max-h-none print:overflow-visible print:p-0">
          {loadingSummary && (
            <div className="p-4 mb-4 text-xs bg-blue-50 text-blue-700 rounded flex items-center space-x-2 print:hidden">
              <span className="animate-spin">⌛</span>
              <span>Loading complete customer financial summary from database...</span>
            </div>
          )}
          
          {/* FORMAT 1: THERMAL RECEIPT (80mm & 58mm) */}
          {(printFormat === 'thermal-80' || printFormat === 'thermal-58') && (
            <div 
              ref={invoiceRef}
              className={`thermal-receipt font-mono text-slate-900 mx-auto p-4 border border-slate-200 rounded shadow-sm bg-white print:border-none print:shadow-none print:p-0 ${
                printFormat === 'thermal-58' ? 'max-w-[240px] print:w-[58mm] text-[11px]' : 'max-w-[320px] print:w-[80mm] text-xs'
              }`}
            >
              {/* Shop Header */}
              <div className="text-center pb-2 border-b border-dashed border-slate-400">
                <h2 className="text-sm font-extrabold uppercase tracking-wide">{shop.shop_name || 'ABC PRINTING CENTER'}</h2>
                <p className="text-[10px] text-slate-600">{shop.address || 'Main Road, Shop No. 12'}</p>
                <p className="text-[10px] text-slate-600">Ph: {shop.phone || '+91 98765 43210'}</p>
                {shop.gst_number && <p className="text-[10px] text-slate-600">GSTIN: {shop.gst_number}</p>}
              </div>

              {/* Bill & Customer Meta */}
              <div className="py-2 border-b border-dashed border-slate-400 space-y-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span>Bill No:</span>
                  <span className="font-bold">{bill.bill_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{formattedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-semibold">{customerName}</span>
                </div>
                {customerMobile && (
                  <div className="flex justify-between">
                    <span>Mobile:</span>
                    <span>{customerMobile}</span>
                  </div>
                )}
                {customerEmail && (
                  <div className="flex justify-between text-[10px]">
                    <span>Email:</span>
                    <span>{customerEmail}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-1">
                  <span>Status:</span>
                  <span className={summary.payment_status === 'Fully Paid' ? 'text-emerald-700' : summary.payment_status === 'Partially Paid' ? 'text-blue-700' : 'text-amber-700'}>
                    Status : {summary.payment_status}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full py-2 my-1 border-b border-dashed border-slate-400 text-[11px]">
                <thead>
                  <tr className="border-b border-slate-300 text-left uppercase text-[10px] font-bold">
                    <th className="py-1">Item</th>
                    <th className="py-1 text-center">Qty</th>
                    <th className="py-1 text-right">Price</th>
                    <th className="py-1 text-right">Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {billItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-1 font-sans">{item.product_name}</td>
                      <td className="py-1 text-center">{item.quantity}</td>
                      <td className="py-1 text-right">₹{item.price.toFixed(2)}</td>
                      <td className="py-1 text-right font-bold">₹{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Current Bill Totals */}
              <div className="space-y-1 py-1 border-b border-dashed border-slate-400 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{subTotal.toFixed(2)}</span>
                </div>
                {discountVal > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Discount:</span>
                    <span>-₹{discountVal.toFixed(2)}</span>
                  </div>
                )}
                {(gstAmount > 0 || (billingConfig.gst_enabled && Number(billingConfig.gst_rate) > 0)) && (
                  <div className="flex justify-between text-slate-600">
                    <span>GST ({billingConfig.gst_rate}%):</span>
                    <span>+₹{gstAmount.toFixed(2)}</span>
                  </div>
                )}
                {roundingAdj !== 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Rounding:</span>
                    <span>{roundingAdj >= 0 ? '+' : ''}₹{roundingAdj.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-extrabold pt-1 border-t border-slate-300">
                  <span>Current Bill:</span>
                  <span>₹{grandTotalVal.toFixed(2)}</span>
                </div>
              </div>

              {/* 1. Customer Ledger Summary */}
              <div className="py-2 border-b border-dashed border-slate-400 text-[11px] space-y-0.5">
                <div className="text-center font-bold uppercase text-[10px] text-slate-700 tracking-wider pb-0.5">--- LEDGER SUMMARY ---</div>
                <div className="flex justify-between">
                  <span>Previous Outstanding:</span>
                  <span>₹{summary.previous_outstanding.toFixed(2)}</span>
                </div>
                {summary.previous_advance > 0.009 && (
                  <div className="flex justify-between text-teal-800">
                    <span>Previous Advance:</span>
                    <span>₹{summary.previous_advance.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Current Bill:</span>
                  <span>₹{summary.current_bill_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-slate-200">
                  <span>Total Amount Due:</span>
                  <span>₹{summary.total_amount_due.toFixed(2)}</span>
                </div>
              </div>

              {/* 2. Payment Summary */}
              <div className="py-2 border-b border-dashed border-slate-400 text-[11px] space-y-0.5">
                <div className="text-center font-bold uppercase text-[10px] text-slate-700 tracking-wider pb-0.5">--- PAYMENT SUMMARY ---</div>
                <div className="flex justify-between font-semibold">
                  <span>Payment Mode:</span>
                  <span className="uppercase font-bold">{bill.payment_method || 'Cash'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash Paid:</span>
                  <span>₹{summary.cash_paid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>UPI Paid:</span>
                  <span>₹{summary.upi_paid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Advance Used:</span>
                  <span>₹{summary.advance_used.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-slate-200">
                  <span>Total Paid:</span>
                  <span>₹{summary.total_paid.toFixed(2)}</span>
                </div>
              </div>

              {/* 3. Balance Summary */}
              <div className="py-2 border-b border-dashed border-slate-400 text-[11px] space-y-1">
                <div className="text-center font-bold uppercase text-[10px] text-slate-700 tracking-wider pb-0.5">--- BALANCE SUMMARY ---</div>
                <div className="flex justify-between font-semibold">
                  <span>Current Bill Balance Due:</span>
                  <span>₹{Math.max(0, summary.current_bill_amount - summary.total_paid).toFixed(2)}</span>
                </div>
                <div className={`flex justify-between font-bold p-1 rounded ${isPending ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-900'}`}>
                  <span>Net Account Balance Due:</span>
                  <span>₹{summary.remaining_balance.toFixed(2)}</span>
                </div>
                {Number(bill.advance_earned || 0) > 0 && (
                  <div className="flex justify-between font-bold text-indigo-700">
                    <span>Advance Credited (This Bill):</span>
                    <span>+₹{Number(bill.advance_earned).toFixed(2)}</span>
                  </div>
                )}
                {summary.remaining_advance_balance > 0.009 && (
                  <div className="flex justify-between">
                    <span>Customer Advance Wallet:</span>
                    <span className="font-semibold text-teal-800">₹{summary.remaining_advance_balance.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* 4. Loyalty Summary (If Enabled) */}
              {summary.loyalty && summary.loyalty.enabled && (
                <div className="py-2 border-b border-dashed border-slate-400 text-[11px] space-y-0.5">
                  <div className="text-center font-bold uppercase text-[10px] text-slate-700 tracking-wider pb-0.5">--- LOYALTY SUMMARY ---</div>
                  {summary.remaining_balance === 0 || summary.loyalty.is_fully_paid ? (
                    <>
                      <div className="flex justify-between font-bold text-emerald-700">
                        <span>Loyalty Points Earned:</span>
                        <span>+{summary.loyalty.points_earned} Points</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span>Previous Points:</span>
                        <span>{summary.loyalty.previous_points} pts</span>
                      </div>
                      {summary.loyalty.points_redeemed > 0 && (
                        <div className="flex justify-between text-[10px] text-rose-600">
                          <span>Points Redeemed:</span>
                          <span>-{summary.loyalty.points_redeemed} pts</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold pt-0.5 border-t border-slate-200">
                        <span>New Loyalty Balance:</span>
                        <span>{summary.loyalty.current_points_balance} pts</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between font-bold text-amber-700">
                        <span>Loyalty Points (This Bill):</span>
                        <span>+{summary.loyalty.points_earned} Points (Pending)</span>
                      </div>
                      {summary.loyalty.total_pending_points !== undefined && summary.loyalty.total_pending_points > summary.loyalty.points_earned && (
                        <div className="flex justify-between text-[10px] font-bold text-amber-900 bg-amber-100/70 px-1.5 py-0.5 rounded border border-amber-300/60">
                          <span>Total Pending on Account:</span>
                          <span>⏳ {summary.loyalty.total_pending_points} Points</span>
                        </div>
                      )}
                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span>Available Spendable Balance:</span>
                        <span>{summary.loyalty.current_points_balance} pts</span>
                      </div>
                      <div className="text-amber-800 text-[9px] font-semibold pt-0.5">
                        ⏳ Points will be credited once this bill is fully paid.
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="text-center pt-3 text-[10px] text-slate-500 uppercase tracking-wider">
                *** {shop.footer_message || 'Thank You for Visiting'} ***
                <br />Powered by PrintPro ERP
              </div>
            </div>
          )}

          {/* FORMAT 2: STANDARD A4 TAX INVOICE */}
          {printFormat === 'a4' && (
            <div 
              ref={invoiceRef}
              className="a4-invoice text-slate-800 p-6 border border-slate-200 rounded-lg bg-white print:border-none print:p-0 print:m-0 print:scale-[0.78] print:origin-top space-y-2.5 print:space-y-1"
            >
              {/* Header */}
              <div className="flex justify-between items-start pb-2.5 print:pb-1 border-b border-slate-200">
                <div>
                  <h1 className="text-2xl print:text-base font-extrabold text-slate-900 uppercase tracking-wide">
                    {billingConfig.gst_enabled ? 'TAX INVOICE' : 'INVOICE'}
                  </h1>
                  <p className="text-sm print:text-xs font-bold text-blue-600 mt-0.5">{shop.shop_name || 'ABC PRINTING CENTER'}</p>
                  <p className="text-xs print:text-[8.5px] text-slate-500">Photocopying, Printing, Lamination & Office Supplies</p>
                  <p className="text-xs print:text-[8.5px] text-slate-500">
                    {shop.address || 'Main Road, Shop No. 12'} • Ph: {shop.phone || '+91 98765 43210'}
                  </p>
                  {shop.gst_number && (
                    <p className="text-xs print:text-[8.5px] text-slate-600 font-mono">GSTIN: {shop.gst_number}</p>
                  )}
                </div>
                <div className="text-right space-y-1 print:space-y-0.5">
                  <div className="text-sm print:text-xs font-bold text-slate-900">Invoice #{bill.bill_number}</div>
                  <div className="text-xs print:text-[8.5px] text-slate-500">Date: {formattedDate}</div>
                  <div className={`inline-block px-2.5 py-0.5 rounded text-xs print:text-[8.5px] font-bold uppercase ${
                    isPending ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    {summary.payment_status === 'Fully Paid' ? 'Status : Fully Paid' : 'Status : Payment Pending'}
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="p-2.5 bg-slate-50 rounded-xl text-xs print:text-[8.5px] grid grid-cols-2 gap-3 border border-slate-200 print:p-1.5">
                <div>
                  <span className="text-slate-400 block uppercase font-bold text-[10px] print:text-[7.5px] tracking-wider">Billed To:</span>
                  <span className="text-base print:text-xs font-extrabold text-slate-900">{customerName}</span>
                  {customerMobile ? (
                    <p className="text-slate-600 font-mono mt-0.5">Mobile: {customerMobile}</p>
                  ) : (
                    <p className="text-slate-400 italic mt-0.5">No registered phone number</p>
                  )}
                  {customerEmail && (
                    <p className="text-slate-600 text-[11px] print:text-[8.5px] mt-0.5">Email: {customerEmail}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block uppercase font-bold text-[10px] print:text-[7.5px] tracking-wider">Payment Mode:</span>
                  <p className="text-sm print:text-xs font-bold text-slate-800 uppercase mt-0.5">
                    {bill.payment_method === 'Split Payment' ? (
                      <span>Split (Cash: ₹{summary.cash_paid.toFixed(2)} + UPI: ₹{summary.upi_paid.toFixed(2)})</span>
                    ) : bill.payment_method === 'Advance Used' ? (
                      <span>Advance Used (₹{summary.advance_used.toFixed(2)})</span>
                    ) : bill.payment_method === 'Pay Later' ? (
                      <span className="text-amber-700">Credit / Pay Later (Khata)</span>
                    ) : (
                      <span>{bill.payment_method || 'Cash'}</span>
                    )}
                  </p>
                  <p className="text-slate-600 font-medium">Total Paid Now: ₹{summary.total_paid.toFixed(2)}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-xs print:text-[8.5px] uppercase font-semibold">
                    <th className="p-2 print:p-0.5 rounded-l">#</th>
                    <th className="p-2 print:p-0.5">Item & Description</th>
                    <th className="p-2 print:p-0.5 text-center">Qty</th>
                    <th className="p-2 print:p-0.5 text-right">Unit Price</th>
                    <th className="p-2 print:p-0.5 text-right rounded-r">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs print:text-[8.5px]">
                  {billItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2 print:p-0.5 text-slate-400 font-data-mono">{idx + 1}</td>
                      <td className="p-2 print:p-0.5 font-medium text-slate-800">{item.product_name}</td>
                      <td className="p-2 print:p-0.5 text-center font-data-mono">{item.quantity}</td>
                      <td className="p-2 print:p-0.5 text-right font-data-mono">₹{item.price.toFixed(2)}</td>
                      <td className="p-2 print:p-0.5 text-right font-data-mono font-bold text-slate-900">₹{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Current Bill Subtotal & Grand Total */}
              <div className="flex justify-end pt-1 border-t border-slate-200">
                <div className="w-64 space-y-1 print:space-y-0 text-xs print:text-[8.5px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-medium">₹{subTotal.toFixed(2)}</span>
                  </div>
                  {discountVal > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Discount:</span>
                      <span className="font-medium text-emerald-600">-₹{discountVal.toFixed(2)}</span>
                    </div>
                  )}
                  {(gstAmount > 0 || (billingConfig.gst_enabled && Number(billingConfig.gst_rate) > 0)) && (
                    <div className="flex justify-between text-slate-600 font-medium">
                      <span>GST ({billingConfig.gst_rate}%):</span>
                      <span className="text-blue-700">+₹{gstAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {roundingAdj !== 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Rounding ({bill.rounding_method || 'Standard'}):</span>
                      <span>{roundingAdj >= 0 ? '+' : ''}₹{roundingAdj.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm print:text-xs font-extrabold pt-1 border-t border-slate-300 text-slate-900">
                    <span>Current Bill Total:</span>
                    <span>₹{grandTotalVal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* DEDICATED CUSTOMER ACCOUNT SUMMARY SECTION */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 print:p-1.5 space-y-2 print:space-y-0.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
                  <h3 className="text-xs print:text-[8.5px] font-extrabold uppercase text-slate-900 tracking-wider">
                    Customer Account Summary
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] print:text-[7.5px] font-bold uppercase ${
                    isPending ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {summary.payment_status === 'Fully Paid' ? 'Status : Fully Paid' : 'Status : Payment Pending'}
                  </span>
                </div>

                <div className="print-summary-grid grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-3 print:gap-1 text-xs print:text-[7.5px]">
                  {/* Ledger Summary */}
                  <div className="bg-white p-2.5 print:p-1 rounded-lg border border-slate-200 space-y-1 print:space-y-0 shadow-sm">
                    <p className="font-bold text-slate-700 uppercase text-[9px] print:text-[7.5px] tracking-wider border-b pb-0.5 text-blue-600">1. Ledger Summary</p>
                    <div className="flex justify-between text-slate-600">
                      <span>Previous Outstanding:</span>
                      <span className="font-semibold text-slate-800">₹{summary.previous_outstanding.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Previous Advance:</span>
                      <span className="font-semibold text-slate-800">₹{summary.previous_advance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Current Bill Amount:</span>
                      <span className="font-semibold text-slate-800">₹{summary.current_bill_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-slate-900 pt-0.5 border-t border-slate-100">
                      <span>Total Amount Due:</span>
                      <span className="text-blue-700">₹{summary.total_amount_due.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Payment Summary */}
                  <div className="bg-white p-2.5 print:p-1 rounded-lg border border-slate-200 space-y-1 print:space-y-0 shadow-sm">
                    <p className="font-bold text-slate-700 uppercase text-[9px] print:text-[7.5px] tracking-wider border-b pb-0.5 text-emerald-600">2. Payment Summary</p>
                    <div className="flex justify-between text-slate-600">
                      <span>Cash Paid:</span>
                      <span className="font-medium">₹{summary.cash_paid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>UPI Paid:</span>
                      <span className="font-medium">₹{summary.upi_paid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Advance Used:</span>
                      <span className="font-medium">₹{summary.advance_used.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-slate-900 pt-0.5 border-t border-slate-100">
                      <span>Total Paid:</span>
                      <span className="text-emerald-700">₹{summary.total_paid.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Balance Summary */}
                  <div className={`p-2.5 print:p-1 rounded-lg border space-y-1 print:space-y-0 shadow-sm ${
                    isPending ? 'bg-amber-50/70 border-amber-200' : 'bg-emerald-50/70 border-emerald-200'
                  }`}>
                    <p className={`font-bold uppercase text-[9px] print:text-[7.5px] tracking-wider border-b pb-0.5 ${
                      isPending ? 'text-amber-800 border-amber-200' : 'text-emerald-800 border-emerald-200'
                    }`}>
                      3. Balance Summary
                    </p>
                    <div className="flex justify-between items-center text-slate-700">
                      <span>Current Bill Due:</span>
                      <span className="font-semibold text-slate-800">
                        ₹{Math.max(0, summary.current_bill_amount - summary.total_paid).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-700">
                      <span>Net Account Balance:</span>
                      <span className={`font-extrabold ${isPending ? 'text-amber-700' : 'text-emerald-700'}`}>
                        ₹{summary.remaining_balance.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[9px] print:text-[7px] text-right font-medium">
                      Status : {summary.payment_status}
                    </p>
                    {Number(bill.advance_earned || 0) > 0 && (
                      <div className="flex justify-between text-indigo-700 font-bold">
                        <span>Advance Credited:</span>
                        <span>+₹{Number(bill.advance_earned).toFixed(2)}</span>
                      </div>
                    )}
                    {summary.remaining_advance_balance > 0.009 && (
                      <div className="flex justify-between text-slate-600 pt-0.5 border-t border-slate-200/60">
                        <span>Customer Advance:</span>
                        <span className="font-semibold text-slate-800">₹{summary.remaining_advance_balance.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Loyalty Summary (If Enabled) */}
                {summary.loyalty && summary.loyalty.enabled && (
                  <div className="bg-white p-2 print:p-0.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs print:text-[7.5px] shadow-sm">
                    <div className="flex items-center space-x-1.5">
                      <span>{summary.remaining_balance === 0 || summary.loyalty.is_fully_paid ? '🎁' : '⏳'}</span>
                      <span className="font-bold text-slate-800 uppercase text-[9px] print:text-[7px] tracking-wider">Loyalty Summary</span>
                    </div>

                    {summary.remaining_balance === 0 || summary.loyalty.is_fully_paid ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <span className="text-emerald-800 block text-[7.5px] font-bold">Earned</span>
                          <span className="font-extrabold text-emerald-700 text-xs print:text-[8.5px]">+{summary.loyalty.points_earned} Pts</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[7.5px]">Previous</span>
                          <span className="font-bold text-slate-800">{summary.loyalty.previous_points} pts</span>
                        </div>
                        {summary.loyalty.points_redeemed > 0 && (
                          <div>
                            <span className="text-slate-500 block text-[7.5px]">Redeemed</span>
                            <span className="font-bold text-rose-600">-{summary.loyalty.points_redeemed} pts</span>
                          </div>
                        )}
                        <div className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          <span className="text-slate-500 block text-[7.5px] font-bold uppercase">Balance</span>
                          <span className="font-extrabold text-blue-700 text-xs print:text-[8.5px]">{summary.loyalty.current_points_balance} pts</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <span className="text-amber-800 block text-[7.5px] font-bold">Pending (This Bill)</span>
                          <span className="font-extrabold text-amber-700 text-xs print:text-[8.5px]">+{summary.loyalty.points_earned} Pts</span>
                        </div>
                        {summary.loyalty.total_pending_points !== undefined && summary.loyalty.total_pending_points > summary.loyalty.points_earned && (
                          <div className="bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
                            <span className="text-amber-900 block text-[7.5px] font-bold">Total Pending (Account)</span>
                            <span className="font-extrabold text-amber-900 text-xs print:text-[8.5px]">⏳ {summary.loyalty.total_pending_points} Pts</span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500 block text-[7.5px]">Available Balance</span>
                          <span className="font-bold text-slate-800">{summary.loyalty.current_points_balance} pts</span>
                        </div>
                        <div className="text-amber-800 font-semibold text-[8px] print:text-[6.5px]">
                          (Credited upon full bill settlement)
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-1 border-t border-slate-200 text-center text-[11px] print:text-[8.5px] text-slate-500">
                {shop.footer_message || 'Thank you for visiting. Powered by PrintPro ERP'}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center print:hidden">
          <button
            onClick={handleShareWhatsAppText}
            className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 rounded-lg border border-emerald-200 flex items-center space-x-1.5 transition"
          >
            <MessageSquare size={14} />
            <span>Share WhatsApp Receipt</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium text-sm transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

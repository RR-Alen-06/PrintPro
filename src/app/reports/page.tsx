'use client';

import React, { useState, useEffect } from 'react';
import { ApiService } from '@/lib/services/api';
import { 
  Bill, 
  CustomerSummary, 
  DateFilterOption, 
  AllSettings, 
  Expense, 
  Payment, 
  InternalTransfer 
} from '@/lib/types';
import { SupabaseBanner } from '@/components/SupabaseBanner';
import { downloadCSV } from '@/lib/utils/csv';
import { REPORTS_DATE_FILTER_BUTTONS } from '@/lib/constants/filters';
import { BusinessReportGenerator } from '@/lib/services/businessReportGenerator';
import { 
  BarChart3, 
  Printer, 
  Users, 
  Receipt,
  FileSpreadsheet,
  Filter,
  IndianRupee,
  CreditCard,
  Wallet,
  TrendingUp,
  Package,
  Download,
  FileText,
  Loader2,
  DollarSign,
  Sparkles,
  ArrowRightLeft
} from 'lucide-react';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'sales' | 'dues' | 'items' | 'expenses' | 'cash_payers' | 'upi_payers' | 'transfers'>('sales');
  const [bills, setBills] = useState<Bill[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [allTransfers, setAllTransfers] = useState<InternalTransfer[]>([]);
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingMaster, setGeneratingMaster] = useState(false);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const loadReportData = async () => {
    setLoading(true);
    try {
      const [filteredBills, custSummaries, fetchedSettings, expensesData, paymentsData, transfersData] = await Promise.all([
        ApiService.getBillsByDateRange(dateFilter, { from: customFrom, to: customTo }),
        ApiService.getCustomerSummaries(),
        ApiService.getSettings(),
        ApiService.getExpenses(),
        ApiService.getPayments(),
        ApiService.getInternalTransfers()
      ]);
      setBills(filteredBills);
      setCustomers(custSummaries);
      setSettings(fetchedSettings);
      setAllExpenses(expensesData || []);
      setAllPayments(paymentsData || []);
      setAllTransfers(transfersData || []);
    } catch (err) {
      console.error('Error fetching report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, customFrom, customTo]);

  // Helper to filter any time-stamped array by the active date range
  const filterByDate = <T extends { created_at: string }>(items: T[], filter: DateFilterOption, range?: { from?: string; to?: string }) => {
    if (filter === 'all_time') return items;
    const now = new Date();
    return items.filter(it => {
      const d = new Date(it.created_at);
      if (isNaN(d.getTime())) return true;
      if (filter === 'today') return d.toDateString() === now.toDateString();
      if (filter === 'yesterday') {
        const y = new Date(now);
        y.setDate(now.getDate() - 1);
        return d.toDateString() === y.toDateString();
      }
      if (filter === 'weekly') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return d >= sevenDaysAgo && d <= now;
      }
      if (filter === 'monthly') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      if (filter === 'quarterly') {
        const curQ = Math.floor(now.getMonth() / 3);
        const expQ = Math.floor(d.getMonth() / 3);
        return curQ === expQ && d.getFullYear() === now.getFullYear();
      }
      if (filter === 'yearly') {
        return d.getFullYear() === now.getFullYear();
      }
      if (filter === 'financial_year') {
        const curM = now.getMonth();
        const curY = now.getFullYear();
        const fyStartY = curM >= 3 ? curY : curY - 1;
        const start = new Date(fyStartY, 3, 1);
        const end = new Date(fyStartY + 1, 2, 31, 23, 59, 59, 999);
        return d >= start && d <= end;
      }
      if (filter === 'custom' && range?.from && range?.to) {
        const fromD = new Date(range.from);
        fromD.setHours(0, 0, 0, 0);
        const toD = new Date(range.to);
        toD.setHours(23, 59, 59, 999);
        return d >= fromD && d <= toD;
      }
      return true;
    });
  };

  const periodExpenses = filterByDate(allExpenses, dateFilter, { from: customFrom, to: customTo });
  const periodPayments = filterByDate(allPayments.filter(p => p.status !== 'CANCELLED' && p.status !== 'REVERSED'), dateFilter, { from: customFrom, to: customTo });
  const periodTransfers = filterByDate(allTransfers, dateFilter, { from: customFrom, to: customTo });

  // Cash Payers: customer bills paid in cash + standalone / dues payments in cash
  const cashPayers: { customer_name: string; ref: string; date: string; amount: number }[] = [];
  bills.forEach(b => {
    if (Number(b.cash_paid || 0) > 0) {
      cashPayers.push({
        customer_name: b.customer_name || 'Walk-in Customer',
        ref: b.bill_number,
        date: b.created_at,
        amount: Number(b.cash_paid || 0)
      });
    }
  });
  periodPayments.forEach(p => {
    if (p.payment_method === 'Cash' && !p.notes?.toLowerCase().includes('initial')) {
      cashPayers.push({
        customer_name: p.customer_name || 'Customer',
        ref: p.payment_number || 'PAY-—',
        date: p.created_at,
        amount: Number(p.amount || 0)
      });
    }
  });
  cashPayers.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // UPI Payers: customer bills paid via UPI + standalone / dues payments via UPI
  const upiPayers: { customer_name: string; ref: string; date: string; amount: number }[] = [];
  bills.forEach(b => {
    if (Number(b.upi_paid || 0) > 0) {
      upiPayers.push({
        customer_name: b.customer_name || 'Walk-in Customer',
        ref: b.bill_number,
        date: b.created_at,
        amount: Number(b.upi_paid || 0)
      });
    }
  });
  periodPayments.forEach(p => {
    if (p.payment_method === 'UPI' && !p.notes?.toLowerCase().includes('initial')) {
      upiPayers.push({
        customer_name: p.customer_name || 'Customer',
        ref: p.payment_number || 'PAY-—',
        date: p.created_at,
        amount: Number(p.amount || 0)
      });
    }
  });
  upiPayers.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Aggregate Metrics for Current Filter
  const totalSales = bills.reduce((sum, b) => sum + Number(b.grand_total || 0), 0);
  const totalPaid = bills.reduce((sum, b) => sum + Math.min(Number(b.grand_total || 0), Number(b.paid_total || 0)), 0);
  const cashTotal = bills.reduce((sum, b) => sum + Number(b.cash_paid || 0), 0);
  const upiTotal = bills.reduce((sum, b) => sum + Number(b.upi_paid || 0), 0);
  const advanceUsedTotal = bills.reduce((sum, b) => sum + Number(b.advance_used || 0), 0);
  const totalTax = bills.reduce((sum, b) => sum + Number(b.gst_amount || 0), 0);
  const totalExpenses = periodExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netProfit = totalSales - totalExpenses;

  // Customer due list & total ledger dues
  const dueCustomers = customers.filter(c => c.balance_due > 0);
  const totalDuesAmount = dueCustomers.reduce((sum, c) => sum + c.balance_due, 0);
  
  // Period-scoped pending balance dynamically calculated for the active date filter
  const pendingTotal = bills.reduce((sum, b) => {
    const g = Number(b.grand_total || 0);
    const p = Math.min(g, Number(b.paid_total || 0));
    return sum + Math.max(0, g - p);
  }, 0);
  const avgBill = bills.length > 0 ? totalSales / bills.length : 0;

  // Aggregate Product / Item sales with proportional discount deduction
  const itemMap = new Map<string, { name: string; qty: number; total: number }>();
  bills.forEach(b => {
    const rawSubtotal = b.items?.reduce((s, it) => s + Number(it.total || 0), 0) || Number(b.total || 0);
    const grandTotal = Number(b.grand_total || 0);
    const factor = rawSubtotal > 0 ? (grandTotal / rawSubtotal) : 1;

    b.items?.forEach(it => {
      const existing = itemMap.get(it.product_name) || { name: it.product_name, qty: 0, total: 0 };
      const netItemTotal = Number(it.total || 0) * factor;
      existing.qty += Number(it.quantity || 0);
      existing.total += netItemTotal;
      itemMap.set(it.product_name, existing);
    });
  });
  const itemSales = Array.from(itemMap.values()).sort((a, b) => b.total - a.total);

  const getFilterLabel = (filter = dateFilter) => {
    if (filter === 'today') return 'Today';
    if (filter === 'yesterday') return 'Yesterday';
    if (filter === 'weekly') return 'Last 7 Days';
    if (filter === 'monthly') return 'This Month';
    if (filter === 'quarterly') return 'This Quarter';
    if (filter === 'yearly') return 'This Year';
    if (filter === 'financial_year') return 'Financial Year (FY)';
    if (filter === 'custom') return `${customFrom || 'Start'} to ${customTo || 'End'}`;
    return 'All Time';
  };

  // Full Executive PDF Report Generator (Active Period)
  const handleExportPdfReport = () => {
    setGeneratingPdf(true);
    try {
      const periodLabel = getFilterLabel();
      const generatedAt = new Date().toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      const doc = BusinessReportGenerator.generateReportPdf({
        shop_settings: settings?.shop || {},
        period_label: periodLabel,
        generated_at: generatedAt,
        kpi: {
          total_sales: totalSales,
          total_paid: totalPaid,
          cash_total: cashTotal,
          upi_total: upiTotal,
          pending_total: pendingTotal,
          total_tax: totalTax,
          total_expenses: totalExpenses,
          net_profit: netProfit,
          total_bills: bills.length,
          avg_bill_value: avgBill,
          total_customers_due: dueCustomers.length,
          total_dues_amount: totalDuesAmount
        },
        bills,
        item_sales: itemSales,
        due_customers: dueCustomers,
        expenses: periodExpenses,
        cash_payers: cashPayers,
        upi_payers: upiPayers,
        transfers: periodTransfers
      });

      const filename = `Business_Report_${dateFilter}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Failed to export PDF report:', err);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // 1-Click All-Time Master PDF Export
  const handleExportMasterPdf = async () => {
    setGeneratingMaster(true);
    try {
      const allBills = await ApiService.getBillsByDateRange('all_time');
      const allExp = await ApiService.getExpenses();
      const custSummaries = await ApiService.getCustomerSummaries();
      const shopSettings = settings?.shop || {};

      const masterSales = allBills.reduce((sum, b) => sum + Number(b.grand_total || 0), 0);
      const masterPaid = allBills.reduce((sum, b) => sum + Math.min(Number(b.grand_total || 0), Number(b.paid_total || 0)), 0);
      const masterCash = allBills.reduce((sum, b) => sum + Number(b.cash_paid || 0), 0);
      const masterUpi = allBills.reduce((sum, b) => sum + Number(b.upi_paid || 0), 0);
      const masterTax = allBills.reduce((sum, b) => sum + Number(b.gst_amount || 0), 0);
      const masterExpenses = allExp.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const masterNetProfit = masterSales - masterExpenses;
      const masterPending = allBills.reduce((sum, b) => {
        const g = Number(b.grand_total || 0);
        const p = Math.min(g, Number(b.paid_total || 0));
        return sum + Math.max(0, g - p);
      }, 0);

      // Aggregate Master Item Sales with proportional discount deduction
      const masterItemMap = new Map<string, { name: string; qty: number; total: number }>();
      allBills.forEach(b => {
        const rawSubtotal = b.items?.reduce((s, it) => s + Number(it.total || 0), 0) || Number(b.total || 0);
        const grandTotal = Number(b.grand_total || 0);
        const factor = rawSubtotal > 0 ? (grandTotal / rawSubtotal) : 1;

        b.items?.forEach(it => {
          const existing = masterItemMap.get(it.product_name) || { name: it.product_name, qty: 0, total: 0 };
          const netItemTotal = Number(it.total || 0) * factor;
          existing.qty += Number(it.quantity || 0);
          existing.total += netItemTotal;
          masterItemMap.set(it.product_name, existing);
        });
      });
      const masterItemSales = Array.from(masterItemMap.values()).sort((a, b) => b.total - a.total);
      const masterDueCust = custSummaries.filter(c => c.balance_due > 0);
      const masterTotalDues = masterDueCust.reduce((sum, c) => sum + c.balance_due, 0);

      const masterCashPayers: { customer_name: string; ref: string; date: string; amount: number }[] = [];
      const masterUpiPayers: { customer_name: string; ref: string; date: string; amount: number }[] = [];
      allBills.forEach(b => {
        if (Number(b.cash_paid || 0) > 0) {
          masterCashPayers.push({
            customer_name: b.customer_name || 'Walk-in Customer',
            ref: b.bill_number,
            date: b.created_at,
            amount: Number(b.cash_paid || 0)
          });
        }
        if (Number(b.upi_paid || 0) > 0) {
          masterUpiPayers.push({
            customer_name: b.customer_name || 'Walk-in Customer',
            ref: b.bill_number,
            date: b.created_at,
            amount: Number(b.upi_paid || 0)
          });
        }
      });
      allPayments.forEach(p => {
        if (p.status !== 'CANCELLED' && p.status !== 'REVERSED' && !p.notes?.toLowerCase().includes('initial')) {
          if (p.payment_method === 'Cash') {
            masterCashPayers.push({
              customer_name: p.customer_name || 'Customer',
              ref: p.payment_number || 'PAY-—',
              date: p.created_at,
              amount: Number(p.amount || 0)
            });
          } else if (p.payment_method === 'UPI') {
            masterUpiPayers.push({
              customer_name: p.customer_name || 'Customer',
              ref: p.payment_number || 'PAY-—',
              date: p.created_at,
              amount: Number(p.amount || 0)
            });
          }
        }
      });
      masterCashPayers.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      masterUpiPayers.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const doc = BusinessReportGenerator.generateReportPdf({
        shop_settings: shopSettings,
        period_label: 'ALL TIME (Complete Inception to Date)',
        generated_at: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        kpi: {
          total_sales: masterSales,
          total_paid: masterPaid,
          cash_total: masterCash,
          upi_total: masterUpi,
          pending_total: masterPending,
          total_tax: masterTax,
          total_expenses: masterExpenses,
          net_profit: masterNetProfit,
          total_bills: allBills.length,
          avg_bill_value: allBills.length > 0 ? masterSales / allBills.length : 0,
          total_customers_due: masterDueCust.length,
          total_dues_amount: masterTotalDues
        },
        bills: allBills,
        item_sales: masterItemSales,
        due_customers: custSummaries,
        expenses: allExp,
        cash_payers: masterCashPayers,
        upi_payers: masterUpiPayers,
        transfers: allTransfers
      });

      doc.save(`MASTER_BUSINESS_REPORT_ALL_TIME_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Failed to generate master PDF:', err);
    } finally {
      setGeneratingMaster(false);
    }
  };

  // Full Multi-Section Consolidated CSV Export (Active Period or All-Time)
  const handleExportFullCSV = async (isMasterAllTime = false) => {
    const filterLabel = isMasterAllTime ? 'ALL TIME (Master Database Export)' : getFilterLabel();
    const dateStr = new Date().toISOString().split('T')[0];

    const exportBills = isMasterAllTime ? await ApiService.getBillsByDateRange('all_time') : bills;
    const exportExpenses = isMasterAllTime ? allExpenses : periodExpenses;
    const exportSales = exportBills.reduce((s, b) => s + Number(b.grand_total || 0), 0);
    const exportPaid = exportBills.reduce((s, b) => s + Number(b.paid_total || 0), 0);
    const exportTax = exportBills.reduce((s, b) => s + Number(b.gst_amount || 0), 0);
    const exportCash = exportBills.reduce((s, b) => s + Number(b.cash_paid || 0), 0);
    const exportUpi = exportBills.reduce((s, b) => s + Number(b.upi_paid || 0), 0);
    const exportPending = exportBills.reduce((s, b) => s + Math.max(0, Number(b.grand_total || 0) - Number(b.paid_total || 0)), 0);
    const exportExpTotal = exportExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const exportNetProfit = exportPaid - exportExpTotal;
    const exportAvgBill = exportBills.length > 0 ? exportSales / exportBills.length : 0;

    const exportItemSalesMap = new Map<string, { name: string; qty: number; total: number }>();
    exportBills.forEach(bill => {
      (bill.items || []).forEach(it => {
        const existing = exportItemSalesMap.get(it.product_name) || { name: it.product_name, qty: 0, total: 0 };
        exportItemSalesMap.set(it.product_name, {
          name: it.product_name,
          qty: existing.qty + Number(it.quantity || 0),
          total: existing.total + Number(it.total || 0)
        });
      });
    });
    const exportItemSales = Array.from(exportItemSalesMap.values()).sort((a, b) => b.total - a.total);
    
    const lines: string[] = [];
    
    // Header
    lines.push(`"${(settings?.shop?.shop_name || 'SimpleBilling Center').toUpperCase()} - ${isMasterAllTime ? 'MASTER ALL-TIME BUSINESS REPORT' : 'PERIOD BUSINESS REPORT'}"`);
    lines.push(`"Report Scope: ${filterLabel} | Generated: ${new Date().toLocaleString('en-IN')}"`);
    lines.push('');
    
    // 1. Executive Summary & Net Profit
    lines.push('"--- 1. EXECUTIVE FINANCIAL SUMMARY & NET PROFIT ---"');
    lines.push('"Metric","Value (INR / Count)"');
    lines.push(`"Total Revenue / Invoiced (INR)","${exportSales.toFixed(2)}"`);
    lines.push(`"Total Collected by Shop (INR)","${exportPaid.toFixed(2)}"`);
    lines.push(`"Total Operating Expenses (INR)","${exportExpTotal.toFixed(2)}"`);
    lines.push(`"Net Operating Profit / Margin (INR)","${exportNetProfit.toFixed(2)}"`);
    lines.push(`"GST / Tax Collected (INR)","${exportTax.toFixed(2)}"`);
    lines.push(`"Cash Collections (INR)","${exportCash.toFixed(2)}"`);
    lines.push(`"UPI Collections (INR)","${exportUpi.toFixed(2)}"`);
    lines.push(`"Period Unpaid Dues (INR)","${exportPending.toFixed(2)}"`);
    lines.push(`"Total Invoices Generated","${exportBills.length}"`);
    lines.push(`"Average Invoice Value (INR)","${exportAvgBill.toFixed(2)}"`);
    lines.push(`"Customers with Outstanding Dues","${dueCustomers.length}"`);
    lines.push(`"Total Ledger Dues Outstanding (INR)","${totalDuesAmount.toFixed(2)}"`);
    lines.push('');

    // 2. Sales Invoices Register
    lines.push(`"--- 2. SALES INVOICES REGISTER (${exportBills.length} Records) ---"`);
    lines.push('"Bill Number","Date Time","Customer Name","Mobile","Payment Mode","Grand Total (INR)","Cash Paid (INR)","UPI Paid (INR)","Advance Used (INR)","Paid Total (INR)","Pending Balance (INR)","Status"');
    exportBills.forEach(b => {
      const isPaid = Number(b.paid_total || 0) >= Number(b.grand_total || 0) - 0.01;
      const pendingAmt = Math.max(0, Number(b.grand_total || 0) - Number(b.paid_total || 0));
      lines.push(`"${b.bill_number}","${new Date(b.created_at).toLocaleString('en-IN')}","${(b.customer_name || 'Walk-in').replace(/"/g, '""')}","${b.customer_mobile || ''}","${b.payment_method || 'Cash'}","${Number(b.grand_total || 0).toFixed(2)}","${Number(b.cash_paid || 0).toFixed(2)}","${Number(b.upi_paid || 0).toFixed(2)}","${Number(b.advance_used || 0).toFixed(2)}","${Number(b.paid_total || 0).toFixed(2)}","${pendingAmt.toFixed(2)}","${isPaid ? 'Paid' : 'Pending'}"`);
    });
    lines.push('');

    // 3. Item Sales Volume
    lines.push(`"--- 3. ITEM & SERVICE SALES VOLUME (${exportItemSales.length} Products) ---"`);
    lines.push('"Product / Service Name","Quantity Sold","Revenue Generated (INR)"');
    exportItemSales.forEach(it => {
      lines.push(`"${it.name.replace(/"/g, '""')}","${it.qty}","${it.total.toFixed(2)}"`);
    });
    lines.push('');

    // 4. Customer Outstanding Dues & Balances Ledger
    lines.push(`"--- 4. CUSTOMER BALANCES & DUES LEDGER (${customers.length} Accounts) ---"`);
    lines.push('"Customer Name","Mobile","Email","Total Billed (INR)","Paid Amount by Customer (INR)","Balance Due (INR)","Advance Available (INR)","Loyalty Points"');
    customers.forEach(c => {
      lines.push(`"${c.name.replace(/"/g, '""')}","${c.mobile || ''}","${c.email || ''}","${Number(c.total_billed).toFixed(2)}","${Number(c.total_paid).toFixed(2)}","${Number(c.balance_due).toFixed(2)}","${Number(c.advance_balance).toFixed(2)}","${c.loyalty_points || 0}"`);
    });
    lines.push('');

    // 5. Operating Expenses Register
    if (exportExpenses.length > 0) {
      lines.push(`"--- 5. OPERATING EXPENSES REGISTER (${exportExpenses.length} Records) ---"`);
      lines.push('"Expense Number","Date","Title / Description","Category","Payment Mode","Amount (INR)","Notes"');
      exportExpenses.forEach(exp => {
        lines.push(`"${exp.expense_number || 'EXP'}","${new Date(exp.created_at).toLocaleDateString('en-IN')}","${exp.title.replace(/"/g, '""')}","${exp.category || 'General'}","${exp.payment_mode || 'Cash'}","${Number(exp.amount).toFixed(2)}","${(exp.notes || '').replace(/"/g, '""')}"`);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(lines.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', isMasterAllTime ? `Master_Business_Report_All_Time_${dateStr}.csv` : `Full_Business_Report_${dateFilter}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Tab-Specific CSV Export
  const _handleExportTabCSV = () => {
    const filterLabel = dateFilter.replace('_', '-');
    if (activeTab === 'sales') {
      const headers = ['Bill Number', 'Date Time', 'Customer', 'Customer Mobile', 'Payment Method', 'Cash (INR)', 'UPI (INR)', 'Advance Used (INR)', 'Grand Total (INR)', 'Paid Total (INR)', 'Status'];
      const rows = bills.map(b => [
        b.bill_number,
        new Date(b.created_at).toLocaleString('en-IN'),
        b.customer_name || 'Walk-in',
        b.customer_mobile || '',
        b.payment_method || 'Cash',
        b.cash_paid || 0,
        b.upi_paid || 0,
        b.advance_used || 0,
        b.grand_total,
        b.paid_total,
        Number(b.paid_total) >= Number(b.grand_total) ? 'Paid' : 'Pending'
      ]);
      downloadCSV(`Sales_Register_${filterLabel}`, headers, rows);
    } else if (activeTab === 'items') {
      const headers = ['Product / Service Name', 'Quantity Sold', 'Revenue Generated (INR)'];
      const rows = itemSales.map(it => [
        it.name,
        it.qty,
        it.total.toFixed(2)
      ]);
      downloadCSV(`Item_Sales_Volume_${filterLabel}`, headers, rows);
    } else if (activeTab === 'dues') {
      const headers = ['Customer Name', 'Mobile Number', 'Email', 'Total Billed (INR)', 'Total Paid (INR)', 'Balance Due (INR)'];
      const rows = dueCustomers.map(c => [
        c.name,
        c.mobile || 'N/A',
        c.email || '',
        c.total_billed,
        c.total_paid,
        c.balance_due
      ]);
      downloadCSV(`Customer_Dues_Ledger_${new Date().toISOString().split('T')[0]}`, headers, rows);
    } else if (activeTab === 'cash_payers') {
      const headers = ['Customer / Entity', 'Reference / Bill #', 'Date & Time', 'Cash Received (INR)'];
      const rows = cashPayers.map(cp => [
        cp.customer_name,
        cp.ref,
        new Date(cp.date).toLocaleString('en-IN'),
        cp.amount.toFixed(2)
      ]);
      downloadCSV(`Cash_Payers_${filterLabel}`, headers, rows);
    } else if (activeTab === 'upi_payers') {
      const headers = ['Customer / Entity', 'Reference / Bill #', 'Date & Time', 'UPI Received (INR)'];
      const rows = upiPayers.map(up => [
        up.customer_name,
        up.ref,
        new Date(up.date).toLocaleString('en-IN'),
        up.amount.toFixed(2)
      ]);
      downloadCSV(`UPI_Payers_${filterLabel}`, headers, rows);
    } else if (activeTab === 'transfers') {
      const headers = ['Transfer #', 'Date & Time', 'Direction', 'Reason / Particulars', 'Amount (INR)'];
      const rows = periodTransfers.map(tr => [
        tr.transfer_number || 'TRANS-—',
        new Date(tr.created_at).toLocaleString('en-IN'),
        tr.direction === 'CASH_TO_UPI' ? 'Cash to UPI' : 'UPI to Cash',
        tr.reason,
        Number(tr.amount || 0).toFixed(2)
      ]);
      downloadCSV(`Contra_Transfers_${filterLabel}`, headers, rows);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  const dateFilterButtons = REPORTS_DATE_FILTER_BUTTONS;

  return (
    <div className="reports-page-root space-y-6">
      <SupabaseBanner />

      {/* Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <BarChart3 className="text-blue-600" size={26} />
            <span>Business Reports & Analytics</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Comprehensive sales registers, volume analytics, operating expenses, and customer dues tracking</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period PDF Report */}
          <button
            onClick={handleExportPdfReport}
            disabled={loading || generatingPdf}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2.5 rounded-lg shadow transition flex items-center space-x-1.5 cursor-pointer"
            title="Download Executive Vector PDF Report for the selected date range"
          >
            {generatingPdf ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <FileText size={15} />
                <span>Period PDF Report</span>
              </>
            )}
          </button>

          {/* Period CSV */}
          <button
            onClick={() => handleExportFullCSV(false)}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2.5 rounded-lg shadow transition flex items-center space-x-1.5 cursor-pointer"
            title="Export Full Multi-Section Business Report for Active Period (CSV)"
          >
            <FileSpreadsheet size={15} />
            <span>Period Full CSV</span>
          </button>

          {/* 1-Click All-Time Master PDF */}
          <button
            onClick={handleExportMasterPdf}
            disabled={loading || generatingMaster}
            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2.5 rounded-lg shadow transition flex items-center space-x-1.5 cursor-pointer"
            title="Download Complete Master PDF of all business history since inception"
          >
            {generatingMaster ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Generating Master...</span>
              </>
            ) : (
              <>
                <Sparkles size={15} className="text-amber-400" />
                <span>All-Time Master PDF</span>
              </>
            )}
          </button>

          {/* 1-Click All-Time Master CSV */}
          <button
            onClick={() => handleExportFullCSV(true)}
            disabled={loading}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2.5 rounded-lg shadow transition flex items-center space-x-1.5 cursor-pointer"
            title="Export All-Time Master CSV of entire database"
          >
            <Download size={14} className="text-emerald-400" />
            <span>All-Time Master CSV</span>
          </button>

          {/* Print Report */}
          <button
            onClick={handlePrintReport}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3 py-2.5 rounded-lg border border-slate-300 transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Printer size={15} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* DATE RANGE FILTER STRIP */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Filter size={15} className="text-blue-600" />
            <span>Date Range:</span>
          </div>

          {/* Quick Date Pills */}
          <div className="flex flex-wrap gap-1.5">
            {dateFilterButtons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => setDateFilter(btn.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  dateFilter === btn.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Pickers */}
        {dateFilter === 'custom' && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-600">From:</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-medium"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-600">To:</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-medium"
              />
            </div>
          </div>
        )}
      </div>

      {/* METRIC CARDS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        {/* Total Sales */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-slate-500 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1">
            <IndianRupee size={13} className="text-blue-600" />
            <span>Total Revenue</span>
          </div>
          <div className="text-base sm:text-lg font-extrabold text-slate-900">₹{totalSales.toFixed(2)}</div>
          <div className="text-[10px] text-slate-400 font-medium">{bills.length} bills generated</div>
        </div>

        {/* Operating Expenses */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-rose-600 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1">
            <TrendingUp size={13} className="text-rose-500 rotate-180" />
            <span>Expenses</span>
          </div>
          <div className="text-base sm:text-lg font-extrabold text-rose-700">₹{totalExpenses.toFixed(2)}</div>
          <div className="text-[10px] text-slate-400 font-medium">{periodExpenses.length} expense records</div>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-emerald-700 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1">
            <DollarSign size={13} className="text-emerald-600" />
            <span>Net Profit</span>
          </div>
          <div className={`text-base sm:text-lg font-extrabold ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            ₹{netProfit.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">Revenue - Expenses</div>
        </div>

        {/* Cash Paid */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-emerald-700 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1">
            <Wallet size={13} className="text-emerald-600" />
            <span>Cash Paid</span>
          </div>
          <div className="text-base sm:text-lg font-extrabold text-emerald-700">₹{cashTotal.toFixed(2)}</div>
          <div className="text-[10px] text-slate-400 font-medium">Direct cash in period</div>
        </div>

        {/* UPI Paid */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-indigo-700 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1">
            <CreditCard size={13} className="text-indigo-600" />
            <span>UPI Paid</span>
          </div>
          <div className="text-base sm:text-lg font-extrabold text-indigo-700">₹{upiTotal.toFixed(2)}</div>
          <div className="text-[10px] text-slate-400 font-medium">Digital collections</div>
        </div>

        {/* Advance Utilized */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-teal-700 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1">
            <Wallet size={13} className="text-teal-600" />
            <span>Advance Used</span>
          </div>
          <div className="text-base sm:text-lg font-extrabold text-teal-700">₹{advanceUsedTotal.toFixed(2)}</div>
          <div className="text-[10px] text-slate-400 font-medium">Non-cash credit applied</div>
        </div>

        {/* Period Pending */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-amber-700 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1">
            <TrendingUp size={13} className="text-amber-600" />
            <span>Period Dues</span>
          </div>
          <div className="text-base sm:text-lg font-extrabold text-amber-700">₹{pendingTotal.toFixed(2)}</div>
          <div className="text-[10px] text-slate-400 font-medium">Unpaid in period</div>
        </div>

        {/* All-Time Customer Dues */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-rose-700 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1">
            <Users size={13} className="text-rose-600" />
            <span>Total Ledger Dues</span>
          </div>
          <div className="text-base sm:text-lg font-extrabold text-rose-700">₹{totalDuesAmount.toFixed(2)}</div>
          <div className="text-[10px] text-slate-400 font-medium">{dueCustomers.length} customer accounts</div>
        </div>
      </div>

      {/* Report Section Tabs */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-2 print:hidden">
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg font-semibold text-xs transition ${
            activeTab === 'sales'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Receipt size={16} />
          <span>Sales & Bills ({bills.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('items')}
          className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg font-semibold text-xs transition ${
            activeTab === 'items'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Package size={16} />
          <span>Item Sales Volume ({itemSales.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('dues')}
          className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg font-semibold text-xs transition ${
            activeTab === 'dues'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users size={16} />
          <span>Customer Due List ({dueCustomers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg font-semibold text-xs transition ${
            activeTab === 'expenses'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp size={16} className="rotate-180 text-rose-500" />
          <span>Operating Expenses ({periodExpenses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('cash_payers')}
          className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg font-semibold text-xs transition ${
            activeTab === 'cash_payers'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Wallet size={16} className={activeTab === 'cash_payers' ? 'text-white' : 'text-emerald-600'} />
          <span>Cash Payers ({cashPayers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('upi_payers')}
          className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg font-semibold text-xs transition ${
            activeTab === 'upi_payers'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CreditCard size={16} className={activeTab === 'upi_payers' ? 'text-white' : 'text-indigo-600'} />
          <span>UPI Payers ({upiPayers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg font-semibold text-xs transition ${
            activeTab === 'transfers'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ArrowRightLeft size={16} className={activeTab === 'transfers' ? 'text-white' : 'text-blue-600'} />
          <span>Contra Transfers ({periodTransfers.length})</span>
        </button>
      </div>

      {/* REPORT CONTENT CARD */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 print:shadow-none print:border-none print:p-0">
        
        {/* TAB 1: SALES & BILLS */}
        {activeTab === 'sales' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Sales Invoices & Transactions</h2>
                <p className="text-xs text-slate-500">Filtered Range: {dateFilter.replace('_', ' ').toUpperCase()}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 uppercase font-semibold">Total Revenue</span>
                <p className="text-xl font-extrabold text-emerald-600">₹{totalSales.toFixed(2)}</p>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Generating report...</div>
            ) : bills.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Receipt className="mx-auto text-slate-300 mb-2" size={40} />
                <p className="font-medium text-slate-700">No bills found for the selected date range.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-4">Bill No</th>
                      <th className="py-2.5 px-4">Date & Time</th>
                      <th className="py-2.5 px-4">Customer</th>
                      <th className="py-2.5 px-4">Payment</th>
                      <th className="py-2.5 px-4 text-right">Cash</th>
                      <th className="py-2.5 px-4 text-right">UPI</th>
                      <th className="py-2.5 px-4 text-right">Advance</th>
                      <th className="py-2.5 px-4 text-right">Total (₹)</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bills.map((b) => {
                      const isPaid = Number(b.paid_total || 0) >= Number(b.grand_total || 0);
                      return (
                        <tr key={b.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{b.bill_number}</td>
                          <td className="py-3 px-4 text-xs text-slate-500">
                            {new Date(b.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800">{b.customer_name || 'Walk-in'}</td>
                          <td className="py-3 px-4 font-semibold text-xs uppercase">{b.payment_method}</td>
                          <td className="py-3 px-4 text-right text-xs font-mono text-emerald-700 font-semibold">
                            ₹{Number(b.cash_paid || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right text-xs font-mono text-indigo-700 font-semibold">
                            ₹{Number(b.upi_paid || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right text-xs font-mono text-teal-700 font-semibold">
                            {Number(b.advance_used || 0) > 0 ? `₹${Number(b.advance_used).toFixed(2)}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                            ₹{Number(b.grand_total).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {isPaid ? 'Fully Paid' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PRODUCT / ITEM SALES BREAKDOWN */}
        {activeTab === 'items' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Product & Service Sales Breakdown</h2>
                <p className="text-xs text-slate-500">Units sold and revenue generated per product</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 uppercase font-semibold">Total Item Types</span>
                <p className="text-xl font-extrabold text-blue-600">{itemSales.length}</p>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Aggregating items...</div>
            ) : itemSales.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Package className="mx-auto text-slate-300 mb-2" size={40} />
                <p className="font-medium text-slate-700">No item sales recorded for this period.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-4">#</th>
                      <th className="py-2.5 px-4">Product / Item Name</th>
                      <th className="py-2.5 px-4 text-center">Total Quantity Sold</th>
                      <th className="py-2.5 px-4 text-right">Revenue Generated (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemSales.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-xs font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{it.name}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">{it.qty}</td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-700">₹{it.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CUSTOMER DUE LIST */}
        {activeTab === 'dues' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Customer Pending Dues List</h2>
                <p className="text-xs text-slate-500">Customers with outstanding running balances across all time</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 uppercase font-semibold">Total Outstanding Dues</span>
                <p className="text-xl font-extrabold text-rose-600">₹{totalDuesAmount.toFixed(2)}</p>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading pending dues list...</div>
            ) : dueCustomers.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Users className="mx-auto text-slate-300 mb-2" size={40} />
                <p className="font-medium text-slate-700">All customer dues settled!</p>
                <p className="text-xs text-slate-400 mt-1">No pending balances found across registered customers.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-4">Customer Name</th>
                      <th className="py-2.5 px-4">Mobile / Email</th>
                      <th className="py-2.5 px-4 text-right">Total Billed (₹)</th>
                      <th className="py-2.5 px-4 text-right">Paid by Cust (₹)</th>
                      <th className="py-2.5 px-4 text-right">Advance Avail (₹)</th>
                      <th className="py-2.5 px-4 text-right">Pending Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dueCustomers.map((c) => (
                      <tr key={c.id}>
                        <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-600">
                          <div>{c.mobile || 'No mobile'}</div>
                          {c.email && <div className="text-blue-600">{c.email}</div>}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-800">₹{c.total_billed.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-medium text-emerald-700">₹{c.total_paid.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-medium text-blue-700">₹{c.advance_balance.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-rose-600">₹{c.balance_due.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: OPERATING EXPENSES */}
        {activeTab === 'expenses' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Operating Expenses</h2>
                <p className="text-xs text-slate-500">Expenses incurred during the selected period</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 uppercase font-semibold">Total Expenses</span>
                <p className="text-xl font-extrabold text-rose-600">₹{totalExpenses.toFixed(2)}</p>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading expenses...</div>
            ) : periodExpenses.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <TrendingUp className="mx-auto text-slate-300 mb-2 rotate-180" size={40} />
                <p className="font-medium text-slate-700">No expenses recorded for this period.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-4">Expense #</th>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Title / Description</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4">Payment Mode</th>
                      <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {periodExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{exp.expense_number || 'EXP'}</td>
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {new Date(exp.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">{exp.title}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {exp.category || 'General'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold uppercase text-slate-600">{exp.payment_mode || 'Cash'}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-rose-600">₹{Number(exp.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: CASH PAYERS BREAKDOWN */}
        {activeTab === 'cash_payers' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Cash Collections by Customer</h2>
                <p className="text-xs text-slate-500">Detailed list of all customers and payers who paid in Cash</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 uppercase font-semibold">Total Cash Collected</span>
                <p className="text-xl font-extrabold text-emerald-600">₹{cashPayers.reduce((s, c) => s + c.amount, 0).toFixed(2)}</p>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading cash payers...</div>
            ) : cashPayers.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Wallet className="mx-auto text-slate-300 mb-2" size={40} />
                <p className="font-medium text-slate-700">No cash payments recorded for this period.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-4">Customer Name</th>
                      <th className="py-2.5 px-4">Ref / Bill #</th>
                      <th className="py-2.5 px-4">Date & Time</th>
                      <th className="py-2.5 px-4 text-right">Cash Received (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cashPayers.map((cp, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">{cp.customer_name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700">{cp.ref}</td>
                        <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                          {new Date(cp.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-600 font-mono">
                          +₹{cp.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: UPI PAYERS BREAKDOWN */}
        {activeTab === 'upi_payers' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">UPI & Bank Collections by Customer</h2>
                <p className="text-xs text-slate-500">Detailed list of all customers and payers who paid via UPI / Bank</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 uppercase font-semibold">Total UPI Collected</span>
                <p className="text-xl font-extrabold text-indigo-600">₹{upiPayers.reduce((s, u) => s + u.amount, 0).toFixed(2)}</p>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading UPI payers...</div>
            ) : upiPayers.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <CreditCard className="mx-auto text-slate-300 mb-2" size={40} />
                <p className="font-medium text-slate-700">No UPI payments recorded for this period.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-4">Customer Name</th>
                      <th className="py-2.5 px-4">Ref / Bill #</th>
                      <th className="py-2.5 px-4">Date & Time</th>
                      <th className="py-2.5 px-4 text-right">UPI Received (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {upiPayers.map((up, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">{up.customer_name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700">{up.ref}</td>
                        <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                          {new Date(up.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-indigo-600 font-mono">
                          +₹{up.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 7: CONTRA TRANSFERS & CONVERSIONS */}
        {activeTab === 'transfers' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Contra Transfers & Conversions (Cash ⇄ UPI)</h2>
                <p className="text-xs text-slate-500">Money transferred between cash drawer and UPI / bank accounts</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 uppercase font-semibold">Total Transfers</span>
                <p className="text-xl font-extrabold text-blue-600">{periodTransfers.length} records</p>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading transfers...</div>
            ) : periodTransfers.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <ArrowRightLeft className="mx-auto text-slate-300 mb-2" size={40} />
                <p className="font-medium text-slate-700">No transfers recorded for this period.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-4">Transfer #</th>
                      <th className="py-2.5 px-4">Date & Time</th>
                      <th className="py-2.5 px-4">Conversion Direction</th>
                      <th className="py-2.5 px-4">Reason / Notes</th>
                      <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {periodTransfers.map((tr) => (
                      <tr key={tr.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{tr.transfer_number || 'TRANS-—'}</td>
                        <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                          {new Date(tr.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            tr.direction === 'CASH_TO_UPI'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {tr.direction === 'CASH_TO_UPI' ? 'Cash -> UPI (Deposit)' : 'UPI -> Cash (Withdrawal)'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 font-medium">{tr.reason}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-slate-900 font-mono">
                          ₹{Number(tr.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

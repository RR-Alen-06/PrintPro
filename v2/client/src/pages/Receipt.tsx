import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { jsPDF } from 'jspdf';
import { Printer, Download, Search as SearchIcon, FileText } from 'lucide-react';
import { apiRequest } from '../api/apiClient';
import type { Invoice } from './Billing';

export default function Receipt() {
  const [selectedBill, setSelectedBill] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: bills, isLoading } = useQuery({
    queryKey: ['bills'],
    queryFn: () => apiRequest<Invoice[]>('/billing/invoices'),
  });

  const filteredBills = (bills || [])
    .filter((b) => !b.isGroupParent)
    .filter((b) =>
      b.billNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.customerName.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#0f172a');
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 15, g: 23, b: 42 };
  };

  const createPDFDoc = async (bill: Invoice) => {
    if (!bill) return null;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const MARGIN = 10;
    const FOOTER_H = 14;
    const MAX_Y = H - MARGIN - FOOTER_H;
    let y = 15;
    let page = 1;

    const rgb = hexToRgb('#4f46e5'); // Using indigo-600

    const ln = (x1: number, y1: number, x2: number, y2: number, width = 0.3) => {
      doc.setLineWidth(width);
      doc.line(x1, y1, x2, y2);
    };
    const txt = (str: string, x: number, yy: number, opts?: any) => doc.text(String(str), x, yy, opts);

    const addFooter = (pageNum: number, totalPages: string | number) => {
      const fy = H - MARGIN;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Thank you for your business!', W / 2, fy - 4, { align: 'center' });
      doc.text(`Page ${pageNum} of ${totalPages}`, W / 2, fy, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    };

    const checkNewPage = (neededSpace = 8) => {
      if (y + neededSpace > MAX_Y) {
        addFooter(page, '?');
        doc.addPage();
        page++;
        y = 15;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        txt('(continued)', W / 2, y, { align: 'center' });
        y += 6;
        txt('Item Name', col.item, y);
        txt('Qty', col.qty, y);
        txt('Unit Price', col.unit, y);
        txt('Disc', col.disc, y);
        txt('GST', col.gst, y);
        txt('Total', col.amt, y);
        y += 2;
        doc.setDrawColor(rgb.r, rgb.g, rgb.b);
        ln(MARGIN, y, W - MARGIN, y, 0.4);
        y += 5;
        doc.setFont('helvetica', 'normal');
        return true;
      }
      return false;
    };

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(rgb.r, rgb.g, rgb.b);
    txt('PrintPro Services', W / 2, y, { align: 'center' });
    y += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    txt('123 Printing Hub, Business Ave', W / 2, y, { align: 'center' });
    y += 5;
    
    y += 2;
    doc.setDrawColor(rgb.r, rgb.g, rgb.b);
    ln(MARGIN, y, W - MARGIN, y, 0.6);
    y += 6;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(rgb.r, rgb.g, rgb.b);
    txt('TAX INVOICE', W / 2, y, { align: 'center' });
    y += 7;

    // Bill Meta
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    txt(`Bill No: ${bill.billNo}`, MARGIN, y);
    txt(`Date: ${bill.date}`, W - MARGIN, y, { align: 'right' });
    y += 5;
    txt(`Customer: ${bill.customerName}`, MARGIN, y);
    txt(`Status: ${bill.status.toUpperCase()}`, W - MARGIN, y, { align: 'right' });
    y += 5;

    y += 3;
    doc.setDrawColor(rgb.r, rgb.g, rgb.b);
    ln(MARGIN, y, W - MARGIN, y, 0.3);
    y += 6;

    // Table Header
    const col = { item: MARGIN, qty: 85, unit: 105, disc: 130, gst: 155, amt: 180 };
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    txt('Item Name', col.item, y);
    txt('Qty', col.qty, y);
    txt('Unit Price', col.unit, y);
    txt('Disc', col.disc, y);
    txt('GST', col.gst, y);
    txt('Total', col.amt, y);
    y += 2;
    doc.setDrawColor(rgb.r, rgb.g, rgb.b);
    ln(MARGIN, y, W - MARGIN, y, 0.4);
    y += 5;

    // Table Body
    doc.setFont('helvetica', 'normal');
    (bill.items || []).forEach((item) => {
      checkNewPage(8);
      const name = item.name || '-';
      const shortName = name.length > 35 ? name.slice(0, 33) + '…' : name;
      txt(shortName, col.item, y);
      txt(String(item.qty || 0), col.qty, y);
      txt(`Rs.${Number(item.unitPrice || 0).toFixed(2)}`, col.unit, y);
      txt(`Rs.${Number(item.discountAmount || 0).toFixed(2)}`, col.disc, y);
      txt(`Rs.${Number(item.lineGst || 0).toFixed(2)}`, col.gst, y);
      txt(`Rs.${Number(item.lineTotal || item.subtotal || 0).toFixed(2)}`, col.amt, y);
      y += 6;
    });

    checkNewPage(10);
    y += 2;
    doc.setDrawColor(rgb.r, rgb.g, rgb.b);
    ln(MARGIN, y, W - MARGIN, y, 0.4);
    y += 7;

    // Totals
    const tCol1 = W - 70;
    const tCol2 = W - MARGIN;
    doc.setFontSize(9);
    txt('Subtotal:', tCol1, y);
    txt(`Rs.${Number(bill.subtotal).toFixed(2)}`, tCol2, y, { align: 'right' });
    y += 5;

    if (bill.discountAmount > 0) {
      txt('Discount:', tCol1, y);
      txt(`-Rs.${Number(bill.discountAmount).toFixed(2)}`, tCol2, y, { align: 'right' });
      y += 5;
    }

    if (bill.gstAmount > 0) {
      txt('Tax (GST):', tCol1, y);
      txt(`+Rs.${Number(bill.gstAmount).toFixed(2)}`, tCol2, y, { align: 'right' });
      y += 5;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    txt('Grand Total:', tCol1, y);
    txt(`Rs.${Number(bill.total).toFixed(2)}`, tCol2, y, { align: 'right' });
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    txt('Amount Paid:', tCol1, y);
    txt(`Rs.${Number(bill.amountPaid).toFixed(2)}`, tCol2, y, { align: 'right' });
    y += 5;

    doc.setFont('helvetica', 'bold');
    if (bill.balance > 0) {
      doc.setTextColor(220, 38, 38);
      txt('Balance Due:', tCol1, y);
      txt(`Rs.${Number(bill.balance).toFixed(2)}`, tCol2, y, { align: 'right' });
    } else {
      doc.setTextColor(22, 163, 74);
      txt('Balance Due:', tCol1, y);
      txt('Rs.0.00', tCol2, y, { align: 'right' });
    }
    doc.setTextColor(0, 0, 0);

    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter(i, totalPages);
    }

    return doc;
  };

  const handleDownloadPDF = async () => {
    if (!selectedBill) return;
    const doc = await createPDFDoc(selectedBill);
    if (doc) doc.save(`Receipt_${selectedBill.billNo}.pdf`);
  };

  const handlePrintPDF = async () => {
    if (!selectedBill) return;
    const doc = await createPDFDoc(selectedBill);
    if (doc) {
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    }
  };

  return (
    <div className="p-8 animate-fadeIn flex flex-col md:flex-row gap-8">
      {/* Left panel - Search & List */}
      <div className="w-full md:w-1/3 flex flex-col h-[calc(100vh-100px)]">
        <h1 className="text-2xl font-bold text-white mb-6">Receipts</h1>
        <div className="relative mb-6">
          <SearchIcon className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search bills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#13121a] border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {isLoading ? (
            <div className="text-gray-500 text-center py-8">Loading...</div>
          ) : filteredBills.length === 0 ? (
            <div className="text-gray-500 text-center py-8">No bills found.</div>
          ) : (
            filteredBills.map((bill) => (
              <div
                key={bill._id}
                onClick={() => setSelectedBill(bill)}
                className={`p-4 rounded-xl cursor-pointer border transition-all ${
                  selectedBill?._id === bill._id
                    ? 'bg-indigo-600/20 border-indigo-500'
                    : 'bg-[#0c0b11] border-gray-800 hover:border-gray-600'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-xs font-bold text-indigo-400">{bill.billNo}</span>
                  <span className="text-xs text-gray-500">{bill.date}</span>
                </div>
                <div className="text-white font-medium mb-1 truncate">{bill.customerName}</div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-white">₹{bill.total.toFixed(2)}</span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    bill.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                    bill.status === 'partial' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {bill.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel - Preview & Actions */}
      <div className="w-full md:w-2/3 bg-[#0c0b11] border border-gray-800 rounded-2xl p-8 flex flex-col">
        {selectedBill ? (
          <>
            <div className="flex justify-between items-center mb-8 pb-6 border-b border-gray-800">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Receipt {selectedBill.billNo}</h2>
                <p className="text-gray-400">{selectedBill.customerName} • {selectedBill.date}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handlePrintPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  <Printer size={18} /> Print
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
                >
                  <Download size={18} /> Download PDF
                </button>
              </div>
            </div>

            <div className="flex-1 bg-white rounded-xl p-8 overflow-y-auto">
              <div className="text-center mb-8 border-b border-gray-200 pb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">PrintPro Services</h1>
                <p className="text-gray-500 text-sm">TAX INVOICE</p>
              </div>
              <div className="flex justify-between mb-8">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Billed To:</p>
                  <p className="font-bold text-gray-900">{selectedBill.customerName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 mb-1">Invoice Info:</p>
                  <p className="font-bold text-gray-900">{selectedBill.billNo}</p>
                  <p className="text-gray-500 text-sm">{selectedBill.date}</p>
                </div>
              </div>
              <table className="w-full mb-8">
                <thead>
                  <tr className="border-y border-gray-200 text-left text-sm text-gray-500">
                    <th className="py-3 font-semibold">Item</th>
                    <th className="py-3 font-semibold text-center">Qty</th>
                    <th className="py-3 font-semibold text-right">Price</th>
                    <th className="py-3 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedBill.items.map((item, i) => (
                    <tr key={i} className="text-gray-800 text-sm">
                      <td className="py-3">{item.name}</td>
                      <td className="py-3 text-center">{item.qty}</td>
                      <td className="py-3 text-right">₹{item.unitPrice.toFixed(2)}</td>
                      <td className="py-3 text-right">₹{item.lineTotal?.toFixed(2) || item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>₹{selectedBill.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedBill.discountAmount > 0 && (
                    <div className="flex justify-between text-red-500">
                      <span>Discount</span>
                      <span>-₹{selectedBill.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedBill.gstAmount > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>GST Tax</span>
                      <span>₹{selectedBill.gstAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 text-lg pt-2 border-t border-gray-200">
                    <span>Total</span>
                    <span>₹{selectedBill.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 pt-2">
                    <span>Amount Paid</span>
                    <span>₹{selectedBill.amountPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 pt-1">
                    <span>Balance Due</span>
                    <span className={selectedBill.balance > 0 ? "text-red-600" : "text-green-600"}>
                      ₹{selectedBill.balance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <FileText size={48} className="mb-4 opacity-20" />
            <p className="text-lg">Select an invoice to preview the receipt.</p>
          </div>
        )}
      </div>
    </div>
  );
}

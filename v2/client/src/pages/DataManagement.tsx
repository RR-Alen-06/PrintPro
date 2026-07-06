import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download, Upload, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../api/apiClient';
import { exportBillsToCSV, exportCustomersToCSV, exportInventoryToCSV, exportPaymentsToCSV, exportExpensesToCSV, createFullBackup } from '../utils/dataExport';

export default function DataManagement() {
  const [exportMessage, setExportMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importType, setImportType] = useState('backup');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showExport = (msg: string) => { setExportMessage(msg); setTimeout(() => setExportMessage(''), 4000); };
  const showImport = (msg: string) => { setImportMessage(msg); setTimeout(() => setImportMessage(''), 4000); };

  // Instead of fetching everything up front, we could fetch on demand.
  // But for CSV exports, fetching individual endpoints is fine.
  
  const handleFullBackup = async () => {
    try {
      const response = await apiRequest<any>('/data-management/export');
      createFullBackup(response.data);
      showExport('Full backup downloaded successfully');
    } catch (error: any) {
      showExport(`Backup failed: ${error.message}`);
    }
  };

  const handleExportBills = async () => {
    const bills = await apiRequest<any[]>('/billing/invoices');
    exportBillsToCSV(bills.filter(b => !b.deleted && !b.isGroupParent));
    showExport(`${bills.length} bills exported to CSV`);
  };

  const handleExportCustomers = async () => {
    const customers = await apiRequest<any[]>('/customers');
    exportCustomersToCSV(customers);
    showExport(`${customers.length} customers exported to CSV`);
  };

  const handleExportInventory = async () => {
    const inventory = await apiRequest<any[]>('/inventory');
    exportInventoryToCSV(inventory);
    showExport(`${inventory.length} inventory items exported to CSV`);
  };

  const handleExportPayments = async () => {
    const payments = await apiRequest<any[]>('/ledger/payments');
    exportPaymentsToCSV(payments);
    showExport(`${payments.length} payments exported to CSV`);
  };

  const handleExportExpenses = async () => {
    const expenses = await apiRequest<any[]>('/expenses');
    exportExpensesToCSV(expenses);
    showExport(`${expenses.length} expenses exported to CSV`);
  };

  const importMutation = useMutation({
    mutationFn: (payload: any) =>
      apiRequest('/data-management/import', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      showImport('Backup restored successfully!');
    },
    onError: (error: any) => {
      showImport(`Error: ${error.message}`);
    }
  });

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (importType === 'backup') {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);
            importMutation.mutate(data);
          } catch (err) {
            showImport('Error: Invalid JSON format');
          }
        };
        reader.readAsText(file);
      } else {
        // Handle CSV import (not fully implemented in backend yet)
        showImport('CSV import coming soon');
      }
    } catch (error: any) {
      showImport(`Error: ${error.message}`);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const exportItems = [
    { label: 'Bills', type: 'bills', action: handleExportBills, desc: 'All active bills with full details' },
    { label: 'Customers', type: 'customers', action: handleExportCustomers, desc: 'All customers with contact & balance info' },
    { label: 'Payments', type: 'payments', action: handleExportPayments, desc: 'All payment records with cash/UPI split' },
    { label: 'Expenses', type: 'expenses', action: handleExportExpenses, desc: 'All expenses with cash/UPI breakdown' },
    { label: 'Inventory', type: 'inventory', action: handleExportInventory, desc: 'Item pricing list' },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fadeIn text-gray-200">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-white">Data Management</h1>
        <p className="text-gray-400 mt-2">Backup, export, and import your data safely.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Export Card */}
        <div className="bg-[#0c0b11] border border-gray-800 rounded-2xl p-6 shadow-lg">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-2">Export Data</h2>
            <p className="text-gray-400 text-sm">Download data in JSON or CSV format for backup or analysis.</p>
          </div>

          <button 
            onClick={handleFullBackup}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/20 mb-3"
          >
            <Download size={18} /> Full Backup (JSON)
          </button>
          <p className="text-gray-500 text-xs mb-6 text-center">
            Complete backup of all data including settings, expenses, and customers.
          </p>

          <div className="border-t border-gray-800 my-6"></div>

          <div className="space-y-3">
            {exportItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between p-4 bg-[#13121a] border border-gray-800 rounded-xl hover:border-gray-700 transition-colors">
                <div>
                  <div className="font-semibold text-white">{item.label} (CSV)</div>
                  <div className="text-xs text-gray-500 mt-1">{item.desc}</div>
                </div>
                <button 
                  onClick={item.action}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Download size={14} /> Export
                </button>
              </div>
            ))}
          </div>

          {exportMessage && (
            <div className="flex items-center gap-2 p-4 mt-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-medium">
              <CheckCircle size={16} /> {exportMessage}
            </div>
          )}
        </div>

        {/* Import Card */}
        <div className="bg-[#0c0b11] border border-gray-800 rounded-2xl p-6 shadow-lg h-fit">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-2">Import Data</h2>
            <p className="text-gray-400 text-sm">Upload JSON/CSV to restore or bulk-add data.</p>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">
              Import Type
            </label>
            <select 
              value={importType} 
              onChange={(e) => setImportType(e.target.value)}
              className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
            >
              <option value="backup">Full Backup (JSON) — restores everything</option>
              {/* <option value="customers">Customers (CSV)</option>
              <option value="inventory">Inventory (CSV)</option> */}
            </select>
          </div>

          <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl mb-6 flex items-start gap-3">
            <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={16} />
            <div className="text-sm text-red-400/90">
              <strong className="text-red-400 block mb-1">Warning</strong>
              Restoring a JSON backup will replace all current data. Proceed with caution.
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={importType === 'backup' ? '.json' : '.csv'}
            onChange={handleImportFile}
            className="hidden"
          />

          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-all border border-gray-700 mb-2"
          >
            <Upload size={18} /> Choose File & Import
          </button>
          
          {importMutation.isPending && (
             <div className="text-center text-gray-400 text-sm mt-4 animate-pulse">Restoring data...</div>
          )}

          {importMessage && (
            <div className={`flex items-center gap-2 p-4 mt-6 rounded-xl text-sm font-medium border ${
              importMessage.startsWith('Error') 
                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              {importMessage.startsWith('Error') ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
              <span>{importMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

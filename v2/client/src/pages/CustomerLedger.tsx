import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/apiClient';
import { BookOpen, User, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface LedgerEntry {
  type: string;
  date: string;
  id: string;
  description: string;
  subtext: string;
  debit: number;
  credit: number;
  balance: number;
}

interface CustomerDetails {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  advanceBalance: number;
  creditBalance: number;
  loyaltyPoints: number;
}

interface LedgerResponse {
  customer: CustomerDetails;
  entries: LedgerEntry[];
  closingBalance: number;
}

interface CustomerSummary {
  _id: string;
  name: string;
  phone?: string;
}

interface CustomerLedgerProps {
  selectedCustomerId?: string;
  onClearSelection?: () => void;
}

export default function CustomerLedger({ selectedCustomerId, onClearSelection }: CustomerLedgerProps) {
  const [customerId, setCustomerId] = useState<string>(selectedCustomerId || '');

  // 1. Fetch customer list for select dropdown
  const { data: customers = [] } = useQuery<CustomerSummary[]>({
    queryKey: ['customersSummary'],
    queryFn: () => apiRequest<CustomerSummary[]>('/customers'),
    enabled: !selectedCustomerId,
  });

  // 2. Fetch ledger data for selected customer
  const { data: ledgerData, isLoading, error } = useQuery<LedgerResponse>({
    queryKey: ['ledger', customerId],
    queryFn: () => apiRequest<LedgerResponse>(`/ledger/${customerId}`),
    enabled: !!customerId,
  });

  const handleSelectCustomer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCustomerId(e.target.value);
  };

  const getBalanceDisplay = (balance: number) => {
    // If balance is positive, Credits > Debits (Customer has advance deposit)
    if (balance > 0) {
      return (
        <span className="text-emerald-400 bg-emerald-500/10 px-4 py-2 border border-emerald-500/20 rounded-xl font-bold">
          Advance Credit: ₹{balance.toFixed(2)}
        </span>
      );
    }
    // If balance is negative, Debits > Credits (Customer owes money)
    if (balance < 0) {
      return (
        <span className="text-amber-400 bg-amber-500/10 px-4 py-2 border border-amber-500/20 rounded-xl font-bold">
          Outstanding Due: ₹{Math.abs(balance).toFixed(2)}
        </span>
      );
    }
    return (
      <span className="text-gray-400 bg-gray-500/10 px-4 py-2 border border-gray-500/20 rounded-xl font-bold">
        Fully Settled: ₹0.00
      </span>
    );
  };

  return (
    <div className="flex-1 bg-[#07060a] text-gray-100 p-8 min-h-screen relative overflow-hidden">
      {/* Glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[120px] top-20 right-20 pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center mb-8 pb-6 border-b border-gray-800/80">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Customer Ledger</h1>
          <p className="text-gray-400 mt-1">Chronological statement of accounts, debits, and credits.</p>
        </div>
        {onClearSelection && selectedCustomerId && (
          <button
            onClick={onClearSelection}
            className="px-4 py-2 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl text-sm font-semibold transition-all cursor-pointer"
          >
            Clear Selected Customer
          </button>
        )}
      </div>

      {/* Customer Selection (Only if not preselected) */}
      {!selectedCustomerId && (
        <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 mb-8 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3 text-gray-400">
            <User size={20} />
            <span className="text-sm font-semibold uppercase tracking-wider">Select Client Ledger:</span>
          </div>
          <select
            value={customerId}
            onChange={handleSelectCustomer}
            className="flex-1 bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm cursor-pointer"
          >
            <option value="">-- Choose Customer --</option>
            {customers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} {c.phone ? `(${c.phone})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Ledger Content */}
      {!customerId ? (
        <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-16 text-center text-gray-500">
          <BookOpen size={48} className="mx-auto text-gray-700 mb-4" />
          <p className="font-semibold text-gray-400">Select a print client to view their statement of account.</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-16 text-center text-red-400">
          <p>Failed to retrieve customer ledger logs.</p>
        </div>
      ) : ledgerData ? (
        <div className="space-y-6">
          {/* Client Ledger Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6">
              <span className="text-xs text-gray-400 block uppercase tracking-wider font-semibold mb-1">Client Profile</span>
              <h3 className="text-lg font-bold text-white mb-1">{ledgerData.customer.name}</h3>
              <p className="text-xs text-gray-500">{ledgerData.customer.phone || 'No phone'} · {ledgerData.customer.email || 'No email'}</p>
            </div>

            <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 flex flex-col justify-center">
              <span className="text-xs text-gray-400 block uppercase tracking-wider font-semibold mb-2">Statement Balance</span>
              <div>{getBalanceDisplay(ledgerData.closingBalance)}</div>
            </div>

            <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 flex flex-col justify-center">
              <span className="text-xs text-gray-400 block uppercase tracking-wider font-semibold mb-1">Loyalty Account</span>
              <h3 className="text-2xl font-black text-purple-400">{ledgerData.customer.loyaltyPoints} pts</h3>
              <p className="text-xs text-gray-500 mt-1">Available for print discounts</p>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-6 border-b border-gray-800/80">
              <h3 className="font-bold text-white">Chronological Transaction Log</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead>
                  <tr className="border-b border-gray-800/80 text-gray-500 uppercase text-xs tracking-wider">
                    <th className="p-6">Date</th>
                    <th className="p-6">Transaction ID</th>
                    <th className="p-6">Description</th>
                    <th className="p-6">Debit (+)</th>
                    <th className="p-6">Credit (-)</th>
                    <th className="p-6">Statement Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {ledgerData.entries.map((entry, index) => (
                    <tr key={`${entry.id}-${index}`} className="hover:bg-gray-900/30 transition-all">
                      <td className="p-6 text-gray-400">{entry.date}</td>
                      <td className="p-6 font-mono text-xs text-purple-400 font-semibold">{entry.id}</td>
                      <td className="p-6">
                        <div className="font-semibold text-white">{entry.description}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{entry.subtext}</div>
                      </td>
                      <td className="p-6 font-semibold">
                        {entry.debit > 0 ? (
                          <span className="text-red-400 flex items-center gap-1">
                            <ArrowUpRight size={14} /> ₹{entry.debit.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="p-6 font-semibold">
                        {entry.credit > 0 ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <ArrowDownLeft size={14} /> ₹{entry.credit.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="p-6 font-bold">
                        {entry.balance > 0 ? (
                          <span className="text-emerald-400">₹{entry.balance.toFixed(2)} (Adv)</span>
                        ) : entry.balance < 0 ? (
                          <span className="text-amber-400">₹{Math.abs(entry.balance).toFixed(2)} (Due)</span>
                        ) : (
                          <span className="text-gray-400">₹0.00</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {ledgerData.entries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-gray-500">
                        No financial logs recorded for this client.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search as SearchIcon } from 'lucide-react';
import { apiRequest } from '../api/apiClient';
import type { Customer } from './Customers';
import type { InventoryItem } from './Inventory';
import type { Invoice } from './Billing';

export default function Search() {
  const [activeTab, setActiveTab] = useState<'bills' | 'customers' | 'inventory'>('bills');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Bill Filters
  const [billStatus, setBillStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Fetch Bills (Server-side search)
  const { data: bills, isLoading: isLoadingBills } = useQuery({
    queryKey: ['billsSearch', searchQuery, billStatus, dateFrom, dateTo],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (billStatus) params.append('status', billStatus);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      return apiRequest<Invoice[]>(`/billing/search?${params.toString()}`);
    },
    enabled: activeTab === 'bills',
  });

  // Fetch Customers (Client-side search)
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiRequest<Customer[]>('/customers'),
    enabled: activeTab === 'customers',
  });

  // Fetch Inventory (Client-side search)
  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiRequest<InventoryItem[]>('/inventory'),
    enabled: activeTab === 'inventory',
  });

  const filteredCustomers = (customers || []).filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone || '').includes(searchQuery)
  );

  const filteredInventory = (inventory || []).filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fadeIn text-gray-200">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-white">Advanced Search</h1>
        <p className="text-gray-400 mt-2">Find bills, customers, and inventory items with powerful filters.</p>
      </div>

      <div className="bg-[#0c0b11] rounded-2xl shadow-lg border border-gray-800 overflow-hidden mb-6">
        <div className="flex border-b border-gray-800 bg-[#13121a]">
          {['bills', 'customers', 'inventory'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-4 font-bold text-sm capitalize transition-all cursor-pointer ${
                activeTab === tab
                  ? 'border-b-2 border-purple-500 text-purple-400 bg-purple-500/5'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-5 border-b border-gray-800 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[300px]">
            <SearchIcon className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#13121a] border border-gray-800 rounded-xl focus:outline-none focus:border-purple-500 transition-all text-sm text-white"
            />
          </div>

          {activeTab === 'bills' && (
            <>
              <select
                value={billStatus}
                onChange={(e) => setBillStatus(e.target.value)}
                className="py-2.5 px-4 bg-[#13121a] border border-gray-800 rounded-xl focus:outline-none focus:border-purple-500 text-sm text-white"
              >
                <option value="">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="py-2.5 px-4 bg-[#13121a] border border-gray-800 rounded-xl focus:outline-none focus:border-purple-500 text-sm text-white"
              />
              <span className="text-gray-500 font-medium">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="py-2.5 px-4 bg-[#13121a] border border-gray-800 rounded-xl focus:outline-none focus:border-purple-500 text-sm text-white"
              />
            </>
          )}
        </div>
      </div>

      <div className="bg-[#0c0b11] rounded-2xl shadow-lg border border-gray-800 overflow-hidden">
        {activeTab === 'bills' && (
          <div className="overflow-x-auto">
            {isLoadingBills ? (
              <div className="p-8 text-center text-gray-500 font-medium">Loading bills...</div>
            ) : bills && bills.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-800">
                <thead className="bg-[#13121a]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Bill No</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {bills.map((bill) => (
                    <tr key={bill._id} className="hover:bg-gray-800/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">{bill.billNo}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{bill.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{bill.customerName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-bold">₹{bill.total.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-lg ${
                          bill.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          bill.status === 'partial' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {bill.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-500 font-medium">No matching bills found.</div>
            )}
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="overflow-x-auto">
            {filteredCustomers.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-800">
                <thead className="bg-[#13121a]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer._id} className="hover:bg-gray-800/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">{customer.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{customer.phone}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 capitalize">{customer.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-500 font-medium">No matching customers found.</div>
            )}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="overflow-x-auto">
            {filteredInventory.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-800">
                <thead className="bg-[#13121a]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Item Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Current Stock</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Reorder Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredInventory.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-800/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">{item.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{item.currentStock || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{item.reorderLevel || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-500 font-medium">No matching inventory items found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

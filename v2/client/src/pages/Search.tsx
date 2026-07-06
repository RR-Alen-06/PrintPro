import React, { useState } from 'react';
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
    c.phone.includes(searchQuery)
  );

  const filteredInventory = (inventory || []).filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Advanced Search</h1>
        <p className="text-slate-500">Find bills, customers, and inventory items with powerful filters.</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="flex border-b border-slate-200">
          {['bills', 'customers', 'inventory'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-3 font-medium text-sm capitalize transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[300px]">
            <SearchIcon className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {activeTab === 'bills' && (
            <>
              <select
                value={billStatus}
                onChange={(e) => setBillStatus(e.target.value)}
                className="py-2 px-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500"
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
                className="py-2 px-3 border border-slate-300 rounded-md"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="py-2 px-3 border border-slate-300 rounded-md"
              />
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {activeTab === 'bills' && (
          <div className="overflow-x-auto">
            {isLoadingBills ? (
              <div className="p-8 text-center text-slate-500">Loading bills...</div>
            ) : bills && bills.length > 0 ? (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Bill No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {bills.map((bill) => (
                    <tr key={bill._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{bill.billNo}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{bill.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{bill.customerName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">₹{bill.total.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          bill.status === 'paid' ? 'bg-green-100 text-green-800' :
                          bill.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {bill.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-slate-500">No matching bills found.</div>
            )}
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="overflow-x-auto">
            {filteredCustomers.length > 0 ? (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer._id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{customer.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{customer.phone}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 capitalize">{customer.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-slate-500">No matching customers found.</div>
            )}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="overflow-x-auto">
            {filteredInventory.length > 0 ? (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Item Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Current Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Reorder Level</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredInventory.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{item.name}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${item.currentStock <= item.reorderLevel ? 'text-red-600' : 'text-slate-700'}`}>
                        {item.currentStock} {item.unit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.reorderLevel} {item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-slate-500">No matching inventory items found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

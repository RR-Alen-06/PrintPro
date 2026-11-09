'use client';

import React, { useState, useEffect } from 'react';
import { ApiService } from '@/lib/services/api';
import { AuditLog } from '@/lib/types';
import { SupabaseBanner } from '@/components/SupabaseBanner';
import { ShieldCheck, Search, Clock, User, Activity } from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const filteredLogs = logs.filter(l =>
    l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.user_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <SupabaseBanner />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <ShieldCheck className="text-blue-600" size={26} />
            <span>Audit Trail & Activity Log</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Track critical user actions, bill discount overrides, payment entries, and setting updates</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
        <Search size={18} className="text-slate-400" />
        <input
          type="text"
          placeholder="Filter audit logs by action, entity, or user..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-sm focus:outline-none text-slate-800"
        />
      </div>

      {/* LOGS TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading audit logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Activity className="mx-auto text-slate-300 mb-3" size={40} />
            <p className="font-medium text-base text-slate-700">No audit logs recorded.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200">
                  <th className="px-6 py-3.5"><span className="flex items-center gap-1.5"><Clock size={12} />Timestamp</span></th>
                  <th className="px-6 py-3.5"><span className="flex items-center gap-1.5"><User size={12} />User</span></th>
                  <th className="px-6 py-3.5">Action</th>
                  <th className="px-6 py-3.5">Entity / Target</th>
                  <th className="px-6 py-3.5">Previous Value</th>
                  <th className="px-6 py-3.5">New Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 text-slate-800">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 text-xs font-data-mono text-slate-500">
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-3.5 text-xs font-bold text-slate-900">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-slate-600">
                          <User size={10} />
                        </span>
                        {log.user_name}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-block px-3 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-slate-800 text-xs">{log.entity}</td>
                    <td className="px-6 py-3.5 text-xs text-slate-400 font-data-mono max-w-xs truncate">
                      {log.previous_value || '—'}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-900 font-data-mono max-w-xs truncate font-semibold">
                      {log.new_value || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

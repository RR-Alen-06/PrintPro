import React, { useState, useEffect } from 'react';
import { X, Calendar, Download, FileText, TrendingUp, CreditCard, ShoppingCart, UserCheck, AlertCircle, Loader2, ExternalLink, Copy } from 'lucide-react';
import { getEodReport, exportEodReportPdf } from '../../api/reports';
import { useAppContext } from '../../context/AppContext';

export default function EodModal({ isOpen, onClose }) {
  const { showToast } = useAppContext();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [eodData, setEodData] = useState(null);
  const [lastPdfUrl, setLastPdfUrl] = useState('');
  const [activeTab, setActiveTab] = useState('bills'); // 'bills' | 'payments' | 'expenses'

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function fetchEod() {
      setLoading(true);
      try {
        const res = await getEodReport(selectedDate);
        if (isMounted && res.data?.success) {
          setEodData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch EOD report:', err);
        showToast('Failed to load EOD report data', 'error');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchEod();
    return () => { isMounted = false; };
  }, [isOpen, selectedDate, showToast]);

  const handleExportPdf = async () => {
    setExporting(true);
    showToast('Generating EOD Report PDF...', 'info');
    try {
      const res = await exportEodReportPdf(selectedDate);
      if (res.data?.success && (res.data.fullUrl || res.data.pdfUrl)) {
        const url = res.data.fullUrl || (window.location.origin + res.data.pdfUrl);
        setLastPdfUrl(url);
        showToast('EOD PDF ready!', 'success');
        window.open(url, '_blank');
      } else {
        showToast('Failed to generate EOD PDF', 'error');
      }
    } catch (err) {
      console.error('Failed to export EOD PDF:', err);
      showToast('Error exporting EOD PDF: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  const summary = eodData?.summary || {};
  const bills = eodData?.bills || [];
  const payments = eodData?.payments || [];
  const expenses = eodData?.expenses_list || [];

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div className="modal-content card" style={{
        width: '100%', maxWidth: '840px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', padding: '24px',
        overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="var(--accent)" /> End-of-Day (EOD) Report
            </h2>
            <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
              Daily financial reconciliation and summary of operations
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '6px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Controls: Date Picker & Export Actions */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '12px', padding: '12px 16px',
          background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} className="text-muted" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Report Date:</span>
            <input
              type="date"
              className="form-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '0.85rem', width: 'auto' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-primary"
              onClick={handleExportPdf}
              disabled={exporting || loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            >
              {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Export PDF
            </button>
          </div>
        </div>

        {/* Body content with scroll */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
              <div>Loading EOD Report for {selectedDate}...</div>
            </div>
          ) : (
            <>
              {/* Snapshot Cards */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))',
                gap: '12px', marginBottom: '16px'
              }}>
                <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL BILLED</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                    ₹{(summary.total_billed || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{summary.bill_count || 0} bills</div>
                </div>

                <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>CASH COLLECTED</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
                    ₹{(summary.collected_cash || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Direct Cash</div>
                </div>

                <div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.08)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                  <div style={{ fontSize: '0.72rem', color: '#8b5cf6', fontWeight: 600 }}>UPI COLLECTED</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#8b5cf6', marginTop: '4px' }}>
                    ₹{(summary.collected_upi || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Digital payments</div>
                </div>

                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>TOTAL EXPENSES</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>
                    ₹{(summary.expenses || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{expenses.length} expense rows</div>
                </div>

                <div style={{ padding: '12px', background: (summary.net_profit || 0) >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>NET PROFIT</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: (summary.net_profit || 0) >= 0 ? '#10b981' : '#ef4444', marginTop: '4px' }}>
                    ₹{(summary.net_profit || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Billed - Expenses</div>
                </div>

                <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600 }}>PENDING DUES</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f59e0b', marginTop: '4px' }}>
                    ₹{(summary.pending_dues || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Uncollected balance</div>
                </div>
              </div>

              {/* Extra Operations Highlights */}
              <div style={{
                display: 'flex', gap: '16px', flexWrap: 'wrap',
                padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)',
                marginBottom: '16px', fontSize: '0.8rem', justifyContent: 'space-between'
              }}>
                <div>
                  <span className="text-muted">Total Collections: </span>
                  <strong style={{ color: '#10b981' }}>₹{(summary.total_collected || 0).toFixed(2)}</strong> ({summary.payment_count || 0} txns)
                </div>
                <div>
                  <span className="text-muted">New Customers: </span>
                  <strong style={{ color: 'var(--accent)' }}>+{summary.new_customers || 0}</strong>
                </div>
                <div>
                  <span className="text-muted">Top Selling Item: </span>
                  <strong>{summary.top_item ? `${summary.top_item.name} (${summary.top_item.qty} pcs · ₹${Number(summary.top_item.revenue || 0).toFixed(2)})` : 'None'}</strong>
                </div>
              </div>

              {/* PDF Banner if generated */}
              {lastPdfUrl && (
                <div style={{
                  padding: '10px 14px', background: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)',
                  marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px'
                }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={15} /> Hosted EOD PDF Generated
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(lastPdfUrl);
                        showToast('PDF link copied to clipboard!', 'success');
                      }}
                      style={{ fontSize: '0.75rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Copy size={12} /> Copy Link
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => window.open(lastPdfUrl, '_blank')}
                      style={{ fontSize: '0.75rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <ExternalLink size={12} /> View
                    </button>
                  </div>
                </div>
              )}

              {/* Tab Selector for Details */}
              <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border)', marginBottom: '12px' }}>
                <button
                  onClick={() => setActiveTab('bills')}
                  style={{
                    padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                    borderBottom: activeTab === 'bills' ? '2px solid var(--accent)' : '2px solid transparent',
                    color: activeTab === 'bills' ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: '0.85rem'
                  }}
                >
                  Bills ({bills.length})
                </button>
                <button
                  onClick={() => setActiveTab('payments')}
                  style={{
                    padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                    borderBottom: activeTab === 'payments' ? '2px solid var(--accent)' : '2px solid transparent',
                    color: activeTab === 'payments' ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: '0.85rem'
                  }}
                >
                  Payments ({payments.length})
                </button>
                <button
                  onClick={() => setActiveTab('expenses')}
                  style={{
                    padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                    borderBottom: activeTab === 'expenses' ? '2px solid var(--accent)' : '2px solid transparent',
                    color: activeTab === 'expenses' ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: '0.85rem'
                  }}
                >
                  Expenses ({expenses.length})
                </button>
              </div>

              {/* Tab 1: Bills */}
              {activeTab === 'bills' && (
                <div>
                  {bills.length === 0 ? (
                    <p className="text-muted" style={{ textAlign: 'center', padding: '24px 0', fontSize: '0.85rem' }}>
                      No bills generated on {selectedDate}.
                    </p>
                  ) : (
                    <div className="table-container" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                      <table className="table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>Bill ID</th>
                            <th>Customer</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Total (₹)</th>
                            <th style={{ textAlign: 'right' }}>Paid (₹)</th>
                            <th style={{ textAlign: 'right' }}>Balance (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bills.map((b) => (
                            <tr key={b.id}>
                              <td style={{ fontFamily: 'monospace' }}>{b.id}</td>
                              <td>{b.customer_name || 'Walk-in Customer'}</td>
                              <td>
                                <span className={`badge ${b.status === 'paid' ? 'badge-success' : b.status === 'partial' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                                  {b.status}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{Number(b.total || 0).toFixed(2)}</td>
                              <td style={{ textAlign: 'right', color: '#10b981' }}>₹{Number(b.amount_paid || 0).toFixed(2)}</td>
                              <td style={{ textAlign: 'right', color: Number(b.balance || 0) > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                                ₹{Number(b.balance || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Payments */}
              {activeTab === 'payments' && (
                <div>
                  {payments.length === 0 ? (
                    <p className="text-muted" style={{ textAlign: 'center', padding: '24px 0', fontSize: '0.85rem' }}>
                      No payments recorded on {selectedDate}.
                    </p>
                  ) : (
                    <div className="table-container" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                      <table className="table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>ID / Time</th>
                            <th>Customer</th>
                            <th>Bill Ref</th>
                            <th style={{ textAlign: 'right' }}>Cash (₹)</th>
                            <th style={{ textAlign: 'right' }}>UPI (₹)</th>
                            <th style={{ textAlign: 'right' }}>Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map((p) => (
                            <tr key={p.id}>
                              <td>{p.date ? new Date(p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `#${p.id}`}</td>
                              <td>{p.customer_name || '-'}</td>
                              <td style={{ fontFamily: 'monospace' }}>{p.bill_id || '-'}</td>
                              <td style={{ textAlign: 'right' }}>₹{Number(p.cash_amount || 0).toFixed(2)}</td>
                              <td style={{ textAlign: 'right' }}>₹{Number(p.upi_amount || 0).toFixed(2)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981' }}>₹{Number(p.total_paid || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Expenses */}
              {activeTab === 'expenses' && (
                <div>
                  {expenses.length === 0 ? (
                    <p className="text-muted" style={{ textAlign: 'center', padding: '24px 0', fontSize: '0.85rem' }}>
                      No expenses recorded on {selectedDate}.
                    </p>
                  ) : (
                    <div className="table-container" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                      <table className="table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>Item Name</th>
                            <th>Category</th>
                            <th>Vendor</th>
                            <th>Method</th>
                            <th style={{ textAlign: 'right' }}>Qty</th>
                            <th style={{ textAlign: 'right' }}>Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expenses.map((e) => (
                            <tr key={e.id}>
                              <td style={{ fontWeight: 500 }}>{e.item_name}</td>
                              <td><span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{e.category}</span></td>
                              <td>{e.vendor_name || '-'}</td>
                              <td><span className="badge" style={{ fontSize: '0.7rem' }}>{(e.payment_method || 'cash').toUpperCase()}</span></td>
                              <td style={{ textAlign: 'right' }}>{e.qty || 1}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>₹{Number(e.total || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useBills, useBillMutations } from '../../hooks/useBillsQuery'
import { useCustomers } from '../../hooks/useCustomersQuery'
import { usePaymentMutations } from '../../hooks/useEntitiesQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import { Layers, Plus, CheckCircle, FileText, ChevronRight, User, Loader2 } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileGroupBilling() {
  const navigate = useNavigate()
  const { showToast, recordPayment: contextRecordPayment } = useAppContext()

  // TanStack Queries & Mutations
  const { data: serverBills = [], isLoading: isLoadingBills } = useBills()
  const { data: serverCustomers = [], isLoading: isLoadingCustomers } = useCustomers()
  const { createBill: createBillMutation, isCreatingBill } = useBillMutations()
  const { createPayment } = usePaymentMutations()

  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedBillIds, setSelectedBillIds] = useState([])
  const [showGroupModal, setShowGroupModal] = useState(false)

  // Sync selectedCustomerId when serverCustomers loads
  useEffect(() => {
    if (!selectedCustomerId && serverCustomers.length > 0) {
      setSelectedCustomerId(serverCustomers[0].id)
    }
  }, [serverCustomers, selectedCustomerId])

  // Unpaid Individual Bills for selected customer
  const unpaidCustomerBills = useMemo(() => {
    return (serverBills || []).filter(b =>
      !b.deleted &&
      !b.isGroupParent &&
      String(b.customerId || b.customer_id) === String(selectedCustomerId) &&
      Number(b.balance || 0) > 0
    )
  }, [serverBills, selectedCustomerId])

  // Group Master Bills list
  const groupMasterBills = useMemo(() => {
    return (serverBills || []).filter(b => b.isGroupParent && !b.deleted)
  }, [serverBills])

  const toggleSelectBill = (id) => {
    if (selectedBillIds.includes(id)) {
      setSelectedBillIds(selectedBillIds.filter(i => i !== id))
    } else {
      setSelectedBillIds([...selectedBillIds, id])
    }
  }

  const handleCreateGroupMaster = async () => {
    if (selectedBillIds.length < 2) {
      showToast('Select at least 2 unpaid bills to consolidate', 'error')
      return
    }

    try {
      const selectedObjList = serverBills.filter(b => selectedBillIds.includes(b.id))
      const totalGroupAmount = selectedObjList.reduce((s, b) => s + Number(b.total || 0), 0)
      const totalGroupBalance = selectedObjList.reduce((s, b) => s + Number(b.balance || 0), 0)
      const cust = serverCustomers.find(c => String(c.id) === String(selectedCustomerId))

      const groupPayload = {
        id: `GROUP-${Date.now()}`,
        invoice_number: `GRP-${Math.floor(1000 + Math.random() * 9000)}`,
        invoiceNumber: `GRP-${Math.floor(1000 + Math.random() * 9000)}`,
        is_group_parent: true,
        isGroupParent: true,
        child_bill_ids: selectedBillIds,
        childBillIds: selectedBillIds,
        customer_id: selectedCustomerId,
        customerId: selectedCustomerId,
        customer_name: cust?.name || 'Client',
        customerName: cust?.name || 'Client',
        date: new Date().toISOString().slice(0, 10),
        total: totalGroupAmount,
        balance: totalGroupBalance,
        status: totalGroupBalance <= 0 ? 'paid' : 'unpaid',
        created_at: new Date().toISOString()
      }

      await createBillMutation(groupPayload)

      if (contextRecordPayment) {
        await contextRecordPayment({
          id: `PAY-GRP-${Date.now()}`,
          groupParentId: groupPayload.id,
          date: new Date().toISOString().slice(0, 10),
          totalPaid: 0,
          notes: `Group Master ${groupPayload.invoiceNumber} created for ${selectedBillIds.length} bills`
        })
      }

      showToast(`Group Master ${groupPayload.invoiceNumber} created!`, 'success')
      setSelectedBillIds([])
      setShowGroupModal(false)
    } catch (e) {
      showToast(e.message || 'Failed to create group master', 'error')
    }
  }

  const isLoading = isLoadingBills || isLoadingCustomers

  return (
    <MobileLayout title="Group Master Billing" onSwitchToDesktop={() => navigate('/group-billing')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>CONSOLIDATED INVOICES</span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>GROUP BILLING</h2>
        </div>
        <button className="mobile-btn mobile-btn-primary" onClick={() => setShowGroupModal(true)} style={{ width: 'auto', padding: '0 14px', fontSize: '0.8rem', minHeight: '38px' }}>
          <Plus size={16} /> + Consolidate
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '30px 16px' }}>
          <Loader2 size={28} className="spin" style={{ color: 'var(--accent-secondary)', margin: '0 auto 8px auto' }} />
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading group invoices...</p>
        </div>
      )}

      {/* Group Master Bills Stack */}
      {!isLoading && groupMasterBills.length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <Layers size={40} style={{ color: 'var(--accent-primary)', opacity: 0.6, marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Group Master Invoices</h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Combine multiple customer bills into a single consolidated invoice.</p>
        </div>
      ) : (
        !isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {groupMasterBills.map(grp => (
              <div key={grp.id} className="mobile-card" onClick={() => navigate(`/mobile/bill/${grp.id}`)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{grp.customerName || grp.customer_name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                      #{grp.invoiceNumber || grp.invoice_number || grp.id} • {grp.childBillIds?.length || grp.child_bill_ids?.length || 0} Child Bills
                    </div>
                  </div>
                  <span className={`mobile-badge ${grp.status === 'paid' ? 'mobile-badge-success' : 'mobile-badge-error'}`}>
                    {(grp.status || 'unpaid').toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Consolidated Total</span>
                  <span className="currency-num" style={{ fontSize: '1.1rem', color: 'var(--accent-primary)' }}>₹{Number(grp.total || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Group Billing Consolidation Modal */}
      <BottomSheet isOpen={showGroupModal} onClose={() => setShowGroupModal(false)} title="Consolidate Customer Bills">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>SELECT CLIENT</label>
            <select className="mobile-input" value={selectedCustomerId} onChange={(e) => { setSelectedCustomerId(e.target.value); setSelectedBillIds([]) }}>
              {(serverCustomers || []).map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
              ))}
            </select>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>Select unpaid bills to combine:</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '35vh', overflowY: 'auto' }}>
            {unpaidCustomerBills.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                No unpaid bills available for this client.
              </div>
            ) : (
              unpaidCustomerBills.map(b => {
                const isSelected = selectedBillIds.includes(b.id)
                return (
                  <div
                    key={b.id}
                    onClick={() => toggleSelectBill(b.id)}
                    style={{
                      padding: '10px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'rgba(255, 47, 176, 0.15)' : 'var(--bg-input)',
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>#{b.invoiceNumber || b.invoice_number || b.id}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date: {b.date}</div>
                    </div>
                    <div className="currency-num" style={{ fontSize: '0.95rem', color: 'var(--accent-primary)' }}>₹{Number(b.total || 0).toFixed(2)}</div>
                  </div>
                )
              })
            )}
          </div>

          <button
            className="mobile-btn mobile-btn-primary"
            disabled={selectedBillIds.length < 2 || isCreatingBill}
            onClick={handleCreateGroupMaster}
          >
            {isCreatingBill ? 'Consolidating...' : `Consolidate ${selectedBillIds.length} Bills into Group Master`}
          </button>
        </div>
      </BottomSheet>
    </MobileLayout>
  )
}

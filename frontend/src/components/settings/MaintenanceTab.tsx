import React, { useState } from 'react'
import { Sliders, RotateCcw, AlertTriangle, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '../../context/AppContext'
import { clearAllCloudData, clearTransactionRecords } from '../../lib/syncService'

export const MaintenanceTab: React.FC = () => {
  const queryClient = useQueryClient()
  const { currentUser, showToast } = useAppContext()

  // Reset Modals State
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmationText, setResetConfirmationText] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  const [showFactoryResetModal, setShowFactoryResetModal] = useState(false)
  const [factoryResetConfirmationText, setFactoryResetConfirmationText] = useState('')
  const [isFactoryResetting, setIsFactoryResetting] = useState(false)

  const handleResetTransactions = async () => {
    if (resetConfirmationText.trim().toUpperCase() !== 'RESET') {
      showToast?.('Type RESET in capital letters to confirm', 'error')
      return
    }

    try {
      setIsResetting(true)
      showToast?.('Clearing transaction records from database...', 'info')
      await clearTransactionRecords()

      const userKey = currentUser?.id ? `printpro-state:${currentUser.id}` : 'printpro-state'
      const currentState = JSON.parse(localStorage.getItem(userKey) || '{}')

      const cleanState = {
        ...currentState,
        bills: [],
        payments: [],
        expenses: [],
        advancePayments: [],
        advances: [],
      }

      localStorage.setItem(userKey, JSON.stringify(cleanState))
      queryClient.clear()
      setShowResetModal(false)
      setResetConfirmationText('')
      showToast?.('Transactions wiped! Reloading application...', 'success')
      setTimeout(() => window.location.reload(), 1000)
    } catch (err: any) {
      console.error(err)
      showToast?.(`Failed to reset transactions: ${err.message || err}`, 'error')
    } finally {
      setIsResetting(false)
    }
  }

  const handleFactoryReset = async () => {
    if (factoryResetConfirmationText.trim().toUpperCase() !== 'FACTORY RESET') {
      showToast?.('Type FACTORY RESET in capital letters to confirm', 'error')
      return
    }

    try {
      setIsFactoryResetting(true)
      showToast?.('Performing full factory reset on database...', 'info')
      await clearAllCloudData()

      if (currentUser?.id) {
        localStorage.removeItem(`printpro-state:${currentUser.id}`)
      }
      localStorage.removeItem('printpro-state')
      queryClient.clear()
      setShowFactoryResetModal(false)
      setFactoryResetConfirmationText('')
      showToast?.('All system data factory reset! Reloading...', 'success')
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (err: any) {
      console.error(err)
      showToast?.(`Failed to factory reset: ${err.message || err}`, 'error')
    } finally {
      setIsFactoryResetting(false)
    }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            background: 'var(--error-bg)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--error)',
          }}
        >
          <Sliders size={18} />
        </div>
        <div>
          <h2 style={{ margin: 0 }}>App Preferences &amp; Maintenance</h2>
          <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>
            Theme, cloud storage, and database management.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        <div
          style={{
            padding: '14px 16px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Theme</div>
          <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
            PrintPro uses a fixed premium dark theme optimized for long work sessions.
          </p>
        </div>

        <div
          style={{
            padding: '14px 16px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Data Storage</div>
          <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
            All data is automatically synchronized and securely stored in your Supabase cloud backend.
          </p>
        </div>

        <div
          style={{
            padding: '16px',
            background: 'rgba(234, 179, 8, 0.08)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <RotateCcw size={20} style={{ color: '#eab308', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#eab308', marginBottom: '4px' }}>
                Reset Transaction History
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                Purges all bills, payments, expenses, and resets customer balance accounts to ₹0. Your customer directory, item catalog, and business settings are preserved.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ borderColor: 'rgba(234, 179, 8, 0.5)', color: '#eab308' }}
                onClick={() => setShowResetModal(true)}
              >
                <RotateCcw size={14} style={{ marginRight: '6px' }} />
                Reset Transactions
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '16px',
            background: 'var(--error-bg)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(239,68,68,0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <AlertTriangle size={20} style={{ color: 'var(--error)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--error)', marginBottom: '4px' }}>
                Full Factory Reset
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                Permanently wipes all transactions, customers, and inventory items. Basic business profile credentials (shop name, phone, GSTIN) are retained.
              </p>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setShowFactoryResetModal(true)}
              >
                <Trash2 size={14} style={{ marginRight: '6px' }} />
                Full Factory Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal: Reset Transactions */}
      {showResetModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div className="card" style={{ maxWidth: '440px', width: '100%', border: '1px solid rgba(234, 179, 8, 0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#eab308', marginBottom: '12px' }}>
              <RotateCcw size={22} />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Confirm Transaction Reset</h3>
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '16px' }}>
              This will erase all Bills, Payments, Expenses, and customer ledger balances. Customer contact details, paper/item catalog, and business settings will be kept.
            </p>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
              Type <strong>RESET</strong> in capital letters to confirm:
            </p>
            <input
              type="text"
              className="form-input"
              value={resetConfirmationText}
              onChange={(e) => setResetConfirmationText(e.target.value)}
              placeholder="RESET"
              style={{ marginBottom: '16px' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowResetModal(false)
                  setResetConfirmationText('')
                }}
                disabled={isResetting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleResetTransactions}
                disabled={resetConfirmationText.trim().toUpperCase() !== 'RESET' || isResetting}
                style={{ backgroundColor: '#eab308', borderColor: '#eab308', color: '#000000', fontWeight: 700 }}
              >
                {isResetting ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Full Factory Reset */}
      {showFactoryResetModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div className="card" style={{ maxWidth: '440px', width: '100%', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', marginBottom: '12px' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Confirm Full Factory Reset</h3>
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '16px' }}>
              This permanently wipes <strong>ALL bills, payments, expenses, customer accounts, and inventory items</strong> from the database. This action is irreversible.
            </p>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
              Type <strong>FACTORY RESET</strong> in capital letters to confirm:
            </p>
            <input
              type="text"
              className="form-input"
              value={factoryResetConfirmationText}
              onChange={(e) => setFactoryResetConfirmationText(e.target.value)}
              placeholder="FACTORY RESET"
              style={{ marginBottom: '16px' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowFactoryResetModal(false)
                  setFactoryResetConfirmationText('')
                }}
                disabled={isFactoryResetting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleFactoryReset}
                disabled={factoryResetConfirmationText.trim().toUpperCase() !== 'FACTORY RESET' || isFactoryResetting}
                style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', fontWeight: 700 }}
              >
                {isFactoryResetting ? 'Resetting All Data...' : 'Confirm Factory Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default MaintenanceTab

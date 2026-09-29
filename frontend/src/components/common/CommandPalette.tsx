import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  X,
  FilePlus,
  Users,
  DollarSign,
  Database,
  Trash2,
  Printer,
  Receipt,
  Package,
  TrendingDown,
  ArrowRight,
  Sparkles,
  Command,
  ArrowUpDown,
  CornerDownLeft,
  LucideIcon,
} from 'lucide-react'
import { useBills } from '../../hooks/useBillsQuery'
import { useCustomers } from '../../hooks/useCustomersQuery'
import { useInventory, useAdvancePayments } from '../../hooks/useEntitiesQuery'
import { useExpenses } from '../../hooks/useExpensesQuery'
import { globalOmniSearch } from '../../utils/search'
import { SequenceService } from '../../services/sequenceService'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

interface ActionItem {
  id: string
  title: string
  subtitle: string
  icon: LucideIcon
  category: 'Actions'
  onSelect: () => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const { data: bills = [] } = useBills()
  const { data: customers = [] } = useCustomers()
  const { data: inventory = [] } = useInventory()
  const { data: expenses = [] } = useExpenses()
  const { data: advances = [] } = useAdvancePayments()

  // Reset and focus on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Quick action shortcuts
  const actionItems: ActionItem[] = useMemo(() => [
    {
      id: 'act-new-bill',
      title: 'Create New Invoice / Bill',
      subtitle: 'Open fast Aurora POS billing terminal',
      icon: FilePlus,
      category: 'Actions',
      onSelect: () => {
        navigate('/billing')
        onClose()
      },
    },
    {
      id: 'act-group-bill',
      title: 'Group Billing Terminal',
      subtitle: 'Create multi-customer bulk orders and job cards',
      icon: Receipt,
      category: 'Actions',
      onSelect: () => {
        navigate('/group-billing')
        onClose()
      },
    },
    {
      id: 'act-customers',
      title: 'Customer Directory & Ledger',
      subtitle: 'Search client 360° workspace, ledger & advances',
      icon: Users,
      category: 'Actions',
      onSelect: () => {
        navigate('/customers')
        onClose()
      },
    },
    {
      id: 'act-finance',
      title: 'Finance & Accounts Hub',
      subtitle: 'Daily cashbook, analytics, refunds & Z-report',
      icon: DollarSign,
      category: 'Actions',
      onSelect: () => {
        navigate('/accounting')
        onClose()
      },
    },
    {
      id: 'act-backup',
      title: '1-Click Cloud Snapshot',
      subtitle: 'Download complete ERP JSON database backup',
      icon: Database,
      category: 'Actions',
      onSelect: () => {
        navigate('/settings?tab=backup')
        onClose()
      },
    },
    {
      id: 'act-trash',
      title: 'Deleted Bills Recycle Bin',
      subtitle: 'Safely recover or purge deleted invoices',
      icon: Trash2,
      category: 'Actions',
      onSelect: () => {
        navigate('/settings?tab=recycle-bin')
        onClose()
      },
    },
    {
      id: 'act-receipt',
      title: 'Thermal Reprint Terminal',
      subtitle: 'Reprint POS receipts and customer vouchers',
      icon: Printer,
      category: 'Actions',
      onSelect: () => {
        navigate('/receipt')
        onClose()
      },
    },
  ], [navigate, onClose])

  // Omni Search Results
  const omniResults = useMemo(() => {
    if (!query.trim()) {
      return { bills: [], customers: [], inventory: [], expenses: [], totalMatches: 0 }
    }
    return globalOmniSearch({
      bills,
      customers,
      inventory,
      expenses,
      advances,
      query,
      limitPerCategory: 4,
    })
  }, [bills, customers, inventory, expenses, advances, query])

  // Flattened searchable list for keyboard navigation
  const flatItems = useMemo(() => {
    const list: any[] = []

    // 1. Matching Actions
    const matchingActions = actionItems.filter(
      (act) =>
        !query.trim() ||
        act.title.toLowerCase().includes(query.toLowerCase()) ||
        act.subtitle.toLowerCase().includes(query.toLowerCase())
    )
    matchingActions.forEach((act) => list.push({ type: 'action', ...act }))

    // 2. Matching Bills
    omniResults.bills.forEach((b: any) => {
      const code = b.invoiceNumber || SequenceService.formatDisplayCode('bill', b.id, 'INV')
      list.push({
        type: 'bill',
        id: b.id,
        title: `Invoice #${code}`,
        subtitle: `${b.customerName || 'Walk-in'} • ₹${Number(b.total || 0).toFixed(2)}`,
        icon: Receipt,
        category: 'Invoices',
        onSelect: () => {
          navigate(`/receipt?id=${b.id}`)
          onClose()
        },
      })
    })

    // 3. Matching Customers
    omniResults.customers.forEach((c: any) => {
      list.push({
        type: 'customer',
        id: c.id,
        title: c.name || 'Unnamed Client',
        subtitle: `${c.phone || 'No phone'} • Balance: ₹${Number(c.creditBalance || 0).toFixed(2)}`,
        icon: Users,
        category: 'Customers',
        onSelect: () => {
          navigate(`/customers?customerId=${c.id}`)
          onClose()
        },
      })
    })

    // 4. Matching Inventory Items
    omniResults.inventory.forEach((i: any) => {
      list.push({
        type: 'inventory',
        id: i.id,
        title: i.name || 'Unnamed Item',
        subtitle: `Rate: ₹${Number(i.colorSingle || i.rate || 0)} • Stock: ${i.stock ?? 'N/A'}`,
        icon: Package,
        category: 'Inventory',
        onSelect: () => {
          navigate(`/inventory`)
          onClose()
        },
      })
    })

    // 5. Matching Expenses
    omniResults.expenses.forEach((e: any) => {
      list.push({
        type: 'expense',
        id: e.id,
        title: `${e.category || 'Expense'} - ₹${Number(e.amount || 0).toFixed(2)}`,
        subtitle: e.notes || e.date || 'Shop expense record',
        icon: TrendingDown,
        category: 'Expenses',
        onSelect: () => {
          navigate('/accounting?tab=expenses')
          onClose()
        },
      })
    })

    return list
  }, [actionItems, omniResults, query, navigate, onClose])

  // Handle Keyboard Nav
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, flatItems.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + flatItems.length) % Math.max(1, flatItems.length))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (flatItems[selectedIndex]) {
          flatItems[selectedIndex].onSelect()
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, flatItems, onClose])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 1, 15, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        zIndex: 9999,
        paddingLeft: '16px',
        paddingRight: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="aurora-glass-card"
        style={{
          width: '100%',
          maxWidth: '640px',
          borderRadius: '18px',
          background: 'linear-gradient(180deg, rgba(20, 10, 38, 0.95) 0%, rgba(9, 4, 20, 0.98) 100%)',
          border: '1px solid var(--border-glass, rgba(0, 240, 255, 0.35))',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.9), 0 0 35px rgba(0, 240, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'commandPalettePop 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            gap: '12px',
          }}
        >
          <Search size={20} style={{ color: 'var(--aurora-cyan, #00f0ff)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search bills, clients, items..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '1.05rem',
              fontWeight: 500,
              width: '100%',
            }}
          />
          {query ? (
            <button
              onClick={() => {
                setQuery('')
                setSelectedIndex(0)
              }}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
            >
              <X size={18} />
            </button>
          ) : (
            <kbd
              style={{
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                padding: '3px 7px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          style={{
            maxHeight: '420px',
            overflowY: 'auto',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {flatItems.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
              No commands or records matching "{query}"
            </div>
          ) : (
            flatItems.map((item, idx) => {
              const Icon = item.icon
              const isSelected = selectedIndex === idx

              return (
                <div
                  key={`${item.type}-${item.id || idx}`}
                  onClick={() => item.onSelect()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(0, 240, 255, 0.12)' : 'transparent',
                    border: isSelected ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid transparent',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: isSelected ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: isSelected ? '1px solid #00f0ff' : '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isSelected ? '#00f0ff' : '#94a3b8',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={16} />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: isSelected ? 700 : 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: '#cbd5e1',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                      }}
                    >
                      {item.category}
                    </span>

                    {isSelected && (
                      <CornerDownLeft size={14} style={{ color: '#00f0ff' }} />
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div
          style={{
            padding: '10px 18px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(5, 2, 12, 0.7)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: '#94a3b8',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span><kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 5px', borderRadius: '4px' }}>↑</kbd> <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 5px', borderRadius: '4px' }}>↓</kbd> to navigate</span>
            <span><kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 5px', borderRadius: '4px' }}>↵</kbd> to select</span>
          </div>
          <div>
            <span>PrintPro Aurora Spotlight</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes commandPalettePop {
          0% { opacity: 0; transform: scale(0.96) translateY(-10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

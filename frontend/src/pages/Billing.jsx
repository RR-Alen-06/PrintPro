import React, { useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { useAppContext } from '../context/AppContext'
import { Copy, FilePlus, Link2, Plus, Trash2, ClipboardList, FileText, X } from 'lucide-react'

const initialRow = {
  id: 'row-1',
  itemId: '',
  itemName: 'A4 Paper',
  printType: 'color',
  sides: 'single',
  qty: 1,
  unitPrice: 10.0,
  amount: 10.0,
}

const Billing = () => {
  const { business, customers, inventory, bills, payments, addBill, addCustomer, recordPayment } = useAppContext()
  const [customerType, setCustomerType] = useState('regular')
  const [customerId, setCustomerId] = useState(customers.find((customer) => customer.type === 'regular')?.id || '')
  const [customerName, setCustomerName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(() => {
    const next = new Date()
    next.setDate(next.getDate() + 7)
    return next.toISOString().slice(0, 10)
  })
  const [itemRows, setItemRows] = useState([initialRow])
  const [discountType, setDiscountType] = useState('flat')
  const [discountValue, setDiscountValue] = useState(0)
  const [cashAmount, setCashAmount] = useState(0)
  const [upiAmount, setUpiAmount] = useState(0)
  const [notes, setNotes] = useState('')
  const [paymentMode, setPaymentMode] = useState('partial')
  const [upiCheckoutAmount, setUpiCheckoutAmount] = useState(0)
  const [followUpCash, setFollowUpCash] = useState(0)
  const [followUpUpi, setFollowUpUpi] = useState(0)
  const [selectedBill, setSelectedBill] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const billRef = useRef(null)

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId),
    [customers, customerId]
  )

  const latestBillItems = useMemo(() => {
    if (!selectedBill) return []
    return selectedBill.items || []
  }, [selectedBill])

  const billPayments = useMemo(() => {
    if (!selectedBill) return []
    return payments.filter((payment) => payment.billId === selectedBill.id)
  }, [payments, selectedBill])

  const openBillModal = (bill) => {
    setSelectedBill(bill)
    setFollowUpCash(0)
    setFollowUpUpi(0)
    setIsModalOpen(true)
  }

  const closeBillModal = () => {
    setSelectedBill(null)
    setIsModalOpen(false)
  }

  const getUpiLink = (amount) => {
    if (!business?.upiId || amount <= 0) return ''
    const params = new URLSearchParams({
      pa: business.upiId,
      pn: business.shopName || 'PrintPro',
      am: amount.toFixed(2),
      cu: 'INR',
      tn: 'Print billing payment',
    })
    return `upi://pay?${params.toString()}`
  }

  const handleGenerateUpiLink = () => {
    const amount = Math.max(netBalance, 0)
    setUpiCheckoutAmount(amount)
  }

  const copyUpiLink = (link) => {
    if (!link) return
    navigator.clipboard.writeText(link)
  }

  const handleRecordFollowUpPayment = () => {
    if (!selectedBill) return
    const cash = Number(followUpCash || 0)
    const upi = Number(followUpUpi || 0)
    if (cash + upi <= 0) return

    recordPayment({
      billId: selectedBill.id,
      customerId: selectedBill.customerId,
      cashAmount: cash,
      upiAmount: upi,
      notes: `Follow-up payment for ${selectedBill.id}`,
    })

    setFollowUpCash(0)
    setFollowUpUpi(0)
  }

  const downloadBillPDF = async () => {
    if (!billRef.current) return
    const canvas = await html2canvas(billRef.current)
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgProps = pdf.getImageProperties(imgData)
    const ratio = Math.min(pageWidth / imgProps.width, pageHeight / imgProps.height)
    const imgWidth = imgProps.width * ratio
    const imgHeight = imgProps.height * ratio
    pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight)
    pdf.save(`${selectedBill.id || 'invoice'}.pdf`)
  }

  const downloadBillImage = async () => {
    if (!billRef.current) return
    const canvas = await html2canvas(billRef.current)
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `${selectedBill.id || 'invoice'}.png`
    link.click()
  }

  const getItemBasePrice = (itemId, printType, sides) => {
    const item = inventory.find((entry) => entry.id === itemId)
    if (!item) return 0
    if (printType === 'color' && sides === 'single') return item.colorSingle
    if (printType === 'color' && sides === 'double') return item.colorDouble
    if (printType === 'bw' && sides === 'single') return item.bwSingle
    if (printType === 'bw' && sides === 'double') return item.bwDouble
    return 0
  }

  const updateRow = (rowId, changes) => {
    setItemRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row
        const nextRow = { ...row, ...changes }
        const unitPrice = changes.unitPrice !== undefined ? Number(changes.unitPrice) : row.unitPrice
        const qty = changes.qty !== undefined ? Number(changes.qty) : row.qty
        const amount = Number((unitPrice || row.unitPrice) * qty)
        return { ...nextRow, amount }
      })
    )
  }

  const updateRowItem = (rowId, updates) => {
    setItemRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row
        const nextRow = { ...row, ...updates }
        const unitPrice = updates.unitPrice ?? row.unitPrice
        const qty = updates.qty ?? row.qty
        const amount = Number((unitPrice || row.unitPrice) * qty)
        return { ...nextRow, amount }
      })
    )
  }

  const addRow = () => {
    const nextIndex = itemRows.length + 1
    setItemRows((current) => [
      ...current,
      {
        id: `row-${nextIndex}`,
        itemId: inventory[0]?.id || '',
        itemName: inventory[0]?.name || 'Custom Item',
        printType: 'color',
        sides: 'single',
        qty: 1,
        unitPrice: inventory[0]?.colorSingle || 0,
        amount: inventory[0]?.colorSingle || 0,
      },
    ])
  }

  const removeRow = (rowId) => {
    setItemRows((current) => current.filter((row) => row.id !== rowId))
  }

  const subtotal = itemRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const discountAmount = discountType === 'percent' ? (subtotal * Number(discountValue || 0)) / 100 : Number(discountValue || 0)
  const total = Math.max(subtotal - discountAmount, 0)
  const amountPaid = Number(cashAmount || 0) + Number(upiAmount || 0)
  const customerCredit = Number(selectedCustomer?.creditBalance || 0)
  const netBalance = Math.max(total - customerCredit - amountPaid, 0)
  const willUseCredit = Math.min(customerCredit, total)
  const finalStatus = amountPaid + willUseCredit >= total ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid'

  const handleCustomerTypeChange = (type) => {
    setCustomerType(type)
    if (type === 'regular') {
      const firstRegular = customers.find((customer) => customer.type === 'regular')
      setCustomerId(firstRegular?.id || '')
      setCustomerName('')
    } else {
      const firstRandom = customers.find((customer) => customer.type === 'random')
      setCustomerId(firstRandom?.id || '')
      setCustomerName(firstRandom?.name || '')
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    let customerIdToUse = selectedCustomer?.id || ''
    const customerNameToUse = customerType === 'regular' ? selectedCustomer?.name || '' : customerName || 'Guest'

    if (customerType === 'random' && !customerIdToUse) {
      const newCustomer = {
        type: 'random',
        name: customerNameToUse,
        phone: '',
        email: '',
        creditBalance: 0,
      }
      customerIdToUse = addCustomer(newCustomer)
      setCustomerId(customerIdToUse)
    }

    const billPayload = {
      customerId: customerIdToUse,
      customerType,
      customerName: customerNameToUse,
      date,
      dueDate,
      subtotal,
      discountType,
      discountValue: Number(discountValue || 0),
      total,
      cashAmount: Number(cashAmount || 0),
      upiAmount: Number(upiAmount || 0),
      amountPaid,
      notes,
      paymentMode,
      items: itemRows.map((row) => ({
        itemId: row.itemId,
        itemName: row.itemName,
        printType: row.printType,
        sides: row.sides,
        qty: Number(row.qty),
        unitPrice: Number(row.unitPrice),
        amount: Number(row.amount),
      })),
    }

    addBill(billPayload)
    setCustomerType('regular')
    setCustomerId(customers.find((customer) => customer.type === 'regular')?.id || '')
    setCustomerName('')
    setItemRows([initialRow])
    setDiscountType('flat')
    setDiscountValue(0)
    setCashAmount(0)
    setUpiAmount(0)
    setNotes('')
    setPaymentMode('partial')
  }

  return (
    <div>
      <div className="page-header">
        <h1>Billing</h1>
        <p>Create orders with full split payment, discount and credit handling.</p>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <div className="bill-view-header">
          <div>
            <h2>New Print Bill</h2>
            <p className="text-muted">Build the bill, add items, and handle cash/UPI payments.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={addRow}>
            <Plus size={16} /> Add item
          </button>
        </div>

        <div className="grid-2" style={{ gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Customer Type</label>
            <div className="radio-group">
              <label className={`radio-option ${customerType === 'regular' ? 'selected' : ''}`}>
                <input type="radio" name="customerType" value="regular" checked={customerType === 'regular'} onChange={() => handleCustomerTypeChange('regular')} />
                Regular
              </label>
              <label className={`radio-option ${customerType === 'random' ? 'selected' : ''}`}>
                <input type="radio" name="customerType" value="random" checked={customerType === 'random'} onChange={() => handleCustomerTypeChange('random')} />
                Random
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Customer</label>
            {customerType === 'regular' ? (
              <select className="form-select" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                {customers.filter((customer) => customer.type === 'regular').map((customer) => (
                  <option value={customer.id} key={customer.id}>
                    {customer.id} — {customer.name}
                  </option>
                ))}
              </select>
            ) : (
              <input className="form-input" type="text" placeholder="Customer name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Bill Date</label>
            <input className="form-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: '24px' }}>
          <div className="bill-view-header">
            <h3>Print Items</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Print Type</th>
                  <th>Sides</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {itemRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <select
                        className="form-select"
                        value={row.itemId}
                        onChange={(event) => {
                          const itemId = event.target.value
                          const selected = inventory.find((item) => item.id === itemId)
                          updateRowItem(row.id, {
                            itemId,
                            itemName: selected?.name || row.itemName,
                            unitPrice: getItemBasePrice(itemId, row.printType, row.sides),
                          })
                        }}
                      >
                        {inventory.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-select"
                        value={row.printType}
                        onChange={(event) => {
                          const printType = event.target.value
                          const price = getItemBasePrice(row.itemId, printType, row.sides)
                          updateRowItem(row.id, { printType, unitPrice: price })
                        }}
                      >
                        <option value="color">Color</option>
                        <option value="bw">B/W</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-select"
                        value={row.sides}
                        onChange={(event) => {
                          const sides = event.target.value
                          const price = getItemBasePrice(row.itemId, row.printType, sides)
                          updateRowItem(row.id, { sides, unitPrice: price })
                        }}
                      >
                        <option value="single">Single</option>
                        <option value="double">Double</option>
                      </select>
                    </td>
                    <td>
                      <input className="form-input" type="number" min="1" value={row.qty} onChange={(event) => updateRow(row.id, { qty: event.target.value })} />
                    </td>
                    <td>
                      <input className="form-input" type="number" min="0" value={row.unitPrice} onChange={(event) => updateRow(row.id, { unitPrice: event.target.value })} />
                    </td>
                    <td>₹{row.amount.toFixed(2)}</td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeRow(row.id)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid-2" style={{ marginTop: '24px', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Discount</label>
            <div className="form-inline">
              <select className="form-select" value={discountType} onChange={(event) => setDiscountType(event.target.value)}>
                <option value="flat">Flat</option>
                <option value="percent">Percent</option>
              </select>
              <input className="form-input" type="number" min="0" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Job notes or print remarks" />
          </div>
        </div>

        <div className="grid-2" style={{ marginTop: '24px', gap: '20px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <h3>Payment</h3>
            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <div className="radio-group">
                <label className={`radio-option ${paymentMode === 'partial' ? 'selected' : ''}`}>
                  <input type="radio" value="partial" checked={paymentMode === 'partial'} onChange={() => setPaymentMode('partial')} />
                  Partial
                </label>
                <label className={`radio-option ${paymentMode === 'full' ? 'selected' : ''}`}>
                  <input type="radio" value="full" checked={paymentMode === 'full'} onChange={() => setPaymentMode('full')} />
                  Full
                </label>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Cash Amount</label>
              <input className="form-input" type="number" min="0" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">UPI Amount</label>
              <input className="form-input" type="number" min="0" value={upiAmount} onChange={(event) => setUpiAmount(event.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">UPI Checkout</label>
              <div className="form-inline" style={{ gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={handleGenerateUpiLink}>
                  <Link2 size={14} /> Generate UPI link
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!upiCheckoutAmount || !business?.upiId}
                  onClick={() => copyUpiLink(getUpiLink(upiCheckoutAmount))}
                >
                  <Copy size={14} /> Copy
                </button>
              </div>
              {business?.upiId ? (
                <p className="text-muted">Use {business.upiId} for UPI transactions. Generated amount: ₹{upiCheckoutAmount.toFixed(2)}</p>
              ) : (
                <p className="text-muted">Set your UPI ID in Settings to generate a payment link.</p>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Credit Balance Available</label>
              <div className="stat-card-value">₹{customerCredit.toFixed(2)}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <h3>Summary</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Subtotal</label>
                <div className="stat-card-value">₹{subtotal.toFixed(2)}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Discount</label>
                <div className="stat-card-value">₹{discountAmount.toFixed(2)}</div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Total</label>
                <div className="stat-card-value">₹{total.toFixed(2)}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Paid</label>
                <div className="stat-card-value">₹{amountPaid.toFixed(2)}</div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Remaining After Credit</label>
              <div className="stat-card-value">₹{netBalance.toFixed(2)}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <span className={`badge badge-${finalStatus === 'paid' ? 'paid' : finalStatus === 'partial' ? 'partial' : 'unpaid'}`}>{finalStatus}</span>
            </div>
            {amountPaid > total && (
              <div className="form-group">
                <p className="form-error">Overpayment will be stored as advance credit for the customer.</p>
              </div>
            )}
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: '24px' }}>
          <FilePlus size={16} /> Generate Bill
        </button>
      </form>

      <div className="card" style={{ marginTop: '24px' }}>
        <div className="bill-view-header">
          <div>
            <h2>Recent Billing Activity</h2>
          </div>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.filter((bill) => !bill.deleted).map((bill) => (
                <tr key={bill.id}>
                  <td>{bill.id}</td>
                  <td>{bill.customerName}</td>
                  <td>₹{bill.total.toFixed(2)}</td>
                  <td>₹{bill.amountPaid.toFixed(2)}</td>
                  <td>₹{bill.balance.toFixed(2)}</td>
                  <td>
                    <span className={`badge badge-${bill.status === 'paid' ? 'paid' : bill.status === 'partial' ? 'partial' : 'unpaid'}`}>
                      {bill.status}
                    </span>
                  </td>
                  <td className="table-actions">
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => openBillModal(bill)}>
                      <ClipboardList size={14} /> View
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => openBillModal(bill)}>
                      <FileText size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && selectedBill && (
        <div className="modal-overlay" onClick={closeBillModal}>
          <div className="modal modal-lg" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Bill Details</h3>
                <p className="text-muted">{selectedBill.id} — {selectedBill.customerName}</p>
              </div>
              <button className="modal-close btn-icon" type="button" onClick={closeBillModal}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" ref={billRef}>
              <div className="bill-view-header" style={{ marginBottom: '16px' }}>
                <div>
                  <div className="bill-view-id">{selectedBill.customerType === 'regular' ? selectedBill.customerId : 'Random Customer'}</div>
                  <h4>{selectedBill.customerName}</h4>
                </div>
                <div>
                  <p>Date: {selectedBill.date}</p>
                  <p>Due: {selectedBill.dueDate}</p>
                  <p>Status: <span className={`badge badge-${selectedBill.status === 'paid' ? 'paid' : selectedBill.status === 'partial' ? 'partial' : 'unpaid'}`}>{selectedBill.status}</span></p>
                </div>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Sides</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBill.items.map((item, index) => (
                      <tr key={`${selectedBill.id}-${index}`}>
                        <td>{item.itemName}</td>
                        <td>{item.printType}</td>
                        <td>{item.sides}</td>
                        <td>{item.qty}</td>
                        <td>₹{item.unitPrice.toFixed(2)}</td>
                        <td>₹{item.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid-2" style={{ gap: '20px', marginTop: '20px' }}>
                <div className="card" style={{ padding: '20px' }}>
                  <h4>Summary</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Subtotal</label>
                      <div className="stat-card-value">₹{selectedBill.subtotal.toFixed(2)}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Discount</label>
                      <div className="stat-card-value">₹{selectedBill.discountValue.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Total</label>
                      <div className="stat-card-value">₹{selectedBill.total.toFixed(2)}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Paid</label>
                      <div className="stat-card-value">₹{selectedBill.amountPaid.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Balance</label>
                    <div className="stat-card-value">₹{selectedBill.balance.toFixed(2)}</div>
                  </div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                  <h4>Payments</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Cash</label>
                      <div className="stat-card-value">₹{selectedBill.paymentMethod?.cash?.toFixed(2) ?? '0.00'}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">UPI</label>
                      <div className="stat-card-value">₹{selectedBill.paymentMethod?.upi?.toFixed(2) ?? '0.00'}</div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Credit used</label>
                    <div className="stat-card-value">₹{selectedBill.creditUsed?.toFixed(2) ?? '0.00'}</div>
                  </div>
                </div>
              </div>
              <div className="card" style={{ marginTop: '20px', padding: '20px' }}>
                <h4>Payment History</h4>
                {billPayments.length > 0 ? (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Cash</th>
                        <th>UPI</th>
                        <th>Total</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billPayments.map((payment) => (
                        <tr key={payment.id}>
                          <td>{new Date(payment.date).toLocaleDateString()}</td>
                          <td>₹{payment.cashAmount.toFixed(2)}</td>
                          <td>₹{payment.upiAmount.toFixed(2)}</td>
                          <td>₹{payment.totalPaid.toFixed(2)}</td>
                          <td>{payment.paymentType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-muted">No payment history available for this bill.</p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={downloadBillPDF}>
                <FileText size={16} /> Download PDF
              </button>
              <button type="button" className="btn btn-secondary" onClick={downloadBillImage}>
                <FilePlus size={16} /> Download Image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Billing

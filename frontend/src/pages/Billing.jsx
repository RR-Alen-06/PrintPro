import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { useAppContext } from '../context/AppContext'
import { Copy, FilePlus, Link2, Plus, Trash2, ClipboardList, FileText, X, CheckCircle, AlertTriangle, Wallet, UserPlus, Tag, Percent, Pencil, Printer, Share2 } from 'lucide-react'
import { uploadPDFReceipt } from '../api/share'
import BillSuccessScreen from '../components/common/BillSuccessScreen'


const makeInitialRow = (inventory) => ({
  id: `row-${Date.now()}`,
  itemId: inventory[0]?.id || '',
  itemName: inventory[0]?.name || 'A4 Paper',
  isCustom: false,
  printType: 'color',
  sides: 'single',
  qty: 1,
  unitPrice: inventory[0]?.colorSingle ?? 10.0,
  amount: inventory[0]?.colorSingle ?? 10.0,
  gstRate: 0,
})

const Billing = () => {
  const { business, customers, settings, inventory, bills, payments, promoCodes, addBill, addCustomer, deleteBill, recordPayment, updateBill, editBill, applyPostDiscount, showAlert, showToast } = useAppContext()
  const location = useLocation()

  const [customerType, setCustomerType] = useState('regular')
  // For regular: select from dropdown
  const [customerId, setCustomerId] = useState(customers.find((c) => c.type === 'regular' && !c.deleted)?.id || '')
  // For random: 'existing' = pick from walk-in list, 'new' = create new
  const [randomMode, setRandomMode] = useState('existing')
  const [randomCustomerId, setRandomCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  // Advance balance usage
  const [advanceUsed, setAdvanceUsed] = useState(0)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(() => {
    const next = new Date()
    next.setDate(next.getDate() + 7)
    return next.toISOString().slice(0, 10)
  })
  const [itemRows, setItemRows] = useState(() => [makeInitialRow(inventory)])
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
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState('')
  const [lastBillId, setLastBillId] = useState(null)

  const [isEditing, setIsEditing] = useState(false)
  const [editingBillId, setEditingBillId] = useState(null)
  const [customGst, setCustomGst] = useState('')

  // Post-bill discount state (inside modal)
  const [discountModalType, setDiscountModalType] = useState('flat')
  const [discountModalValue, setDiscountModalValue] = useState(0)
  const [discountApplyMsg, setDiscountApplyMsg] = useState('')

  // Decimal rounding state
  const [showRoundingModal, setShowRoundingModal] = useState(false)
  const [pendingBillPayload, setPendingBillPayload] = useState(null)

  // Refund Modal state
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundInfo, setRefundInfo] = useState(null)
  const [refundMethod, setRefundMethod] = useState('cash')
  const [refundChoice, setRefundChoice] = useState('direct')
  const [customerUpiId, setCustomerUpiId] = useState('')
  const [refundQrGenerated, setRefundQrGenerated] = useState(false)

  // Promo Code state
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [promoError, setPromoError] = useState('')
  const [appliedPromo, setAppliedPromo] = useState(null)

  // Loyalty points state
  const [loyaltyPointsRedeemedInput, setLoyaltyPointsRedeemedInput] = useState('')
  const [shouldRedeemPoints, setShouldRedeemPoints] = useState(false)
  const [changeHandling, setChangeHandling] = useState('advance')

  const billRef = useRef(null)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const editId = params.get('edit')
    if (editId) {
      const billToEdit = bills.find((b) => b.id === editId)
      if (billToEdit) {
        setIsEditing(true)
        setEditingBillId(billToEdit.id)
        setCustomerType(billToEdit.customerType || 'regular')
        if (billToEdit.customerType === 'regular') {
          setCustomerId(billToEdit.customerId)
        } else {
          setRandomCustomerId(billToEdit.customerId)
          setRandomMode('existing')
        }
        setCustomerName(billToEdit.customerName || '')
        setCustomerPhone(billToEdit.customerPhone || '')
        setCustomerEmail(billToEdit.customerEmail || '')
        setDate(billToEdit.date || new Date().toISOString().slice(0, 10))
        setDueDate(billToEdit.dueDate || '')
        setDiscountType(billToEdit.discountType || 'flat')
        setDiscountValue(billToEdit.discountValue || 0)
        setCashAmount(billToEdit.paymentMethod?.cash || 0)
        setUpiAmount(billToEdit.paymentMethod?.upi || 0)
        setNotes(billToEdit.notes || '')
        setLoyaltyPointsRedeemedInput(String(billToEdit.loyaltyPointsRedeemed || ''))
        setShouldRedeemPoints(Number(billToEdit.loyaltyPointsRedeemed || 0) > 0)
        
        // Map bill items to itemRows with unique row ids
        const loadedRows = billToEdit.items.map((item, idx) => {
          const invItem = inventory.find((i) => i.id === item.itemId)
          return {
            id: `row-${Date.now()}-${idx}-${Math.random()}`,
            itemId: item.itemId || '',
            itemName: item.itemName || item.name || (invItem?.name) || 'Custom Item',
            isCustom: !item.itemId,
            printType: item.printType || 'color',
            sides: item.sides || 'single',
            qty: item.qty || 1,
            unitPrice: item.unitPrice || 0,
            amount: item.amount || 0,
            gstRate: item.gstRate || 0,
          }
        })
        setItemRows(loadedRows.length > 0 ? loadedRows : [makeInitialRow(inventory)])
      }
    }
  }, [location.search, bills, inventory])

  // ── Derived from live bills state so modal always reflects latest ──────────
  const liveBill = useMemo(() => {
    if (!selectedBill) return null
    return bills.find((b) => b.id === selectedBill.id) || selectedBill
  }, [bills, selectedBill])

  const successBill = useMemo(() => {
    if (!lastBillId) return null
    return bills.find((b) => b.id === lastBillId)
  }, [bills, lastBillId])

  const billPayments = useMemo(() => {
    if (!liveBill) return []
    return payments.filter((p) => p.billId === liveBill.id)
  }, [payments, liveBill])

  const selectedCustomer = useMemo(() => {
    if (customerType === 'regular') return customers.find((c) => c.id === customerId)
    if (customerType === 'random' && randomMode === 'existing') return customers.find((c) => c.id === randomCustomerId)
    return null
  }, [customers, customerId, customerType, randomMode, randomCustomerId])

  const activeRegular = useMemo(() => customers.filter((c) => c.type === 'regular' && !c.deleted), [customers])
  const activeRandom = useMemo(() => customers.filter((c) => c.type === 'random' && !c.deleted), [customers])

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openBillModal = (bill) => {
    setSelectedBill(bill)
    setFollowUpCash(0)
    setFollowUpUpi(0)
    setPaymentSuccess(false)
    setDiscountModalType(bill.discountType || 'flat')
    setDiscountModalValue(bill.discountValue || 0)
    setDiscountApplyMsg('')
    setIsModalOpen(true)
  }

  const closeBillModal = () => {
    setSelectedBill(null)
    setIsModalOpen(false)
    setPaymentSuccess(false)
  }

  // ── UPI helpers ────────────────────────────────────────────────────────────
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
    setUpiCheckoutAmount(Math.max(netBalance, 0))
  }

  const copyUpiLink = (link) => {
    if (!link) return
    navigator.clipboard.writeText(link)
  }

  // ── Follow-up payment ──────────────────────────────────────────────────────
  const handleRecordFollowUpPayment = () => {
    if (!liveBill) return
    const cash = Number(followUpCash || 0)
    const upi = Number(followUpUpi || 0)
    if (cash + upi <= 0) return

    recordPayment({
      billId: liveBill.id,
      customerId: liveBill.customerId,
      cashAmount: cash,
      upiAmount: upi,
      notes: `Follow-up payment for ${liveBill.id}`,
    })

    setFollowUpCash(0)
    setFollowUpUpi(0)
    setPaymentSuccess(true)
    // Sync selectedBill so the derived liveBill picks up the change next render
    setTimeout(() => setPaymentSuccess(false), 3500)
  }

  // ── Quick Presets & Templates (derived from inventory) ──────────────────────
  const PRESETS = useMemo(() => {
    const getPrice = (item, printType, sides) => {
      if (printType === 'color' && sides === 'single') return item.colorSingle || 0
      if (printType === 'color' && sides === 'double') return item.colorDouble || 0
      if (printType === 'bw' && sides === 'single') return item.bwSingle || 0
      if (printType === 'bw' && sides === 'double') return item.bwDouble || 0
      return 0
    }
    const presets = []
    inventory.forEach((item) => {
      ;[['bw', 'single'], ['bw', 'double'], ['color', 'single'], ['color', 'double']].forEach(([printType, sides]) => {
        const price = getPrice(item, printType, sides)
        if (price > 0) {
          presets.push({
            name: `${item.name} ${printType.toUpperCase()} ${sides === 'single' ? 'S' : 'D'}`,
            label: `${item.name} ${printType === 'bw' ? 'B&W' : 'Color'} ${sides.charAt(0).toUpperCase() + sides.slice(1)}`,
            itemId: item.id,
            printType,
            sides,
            isCustom: false,
          })
        }
      })
    })
    return presets
  }, [inventory])

  const addPreset = (preset) => {
    setDuplicateWarning('')
    setItemRows((current) => {
      let existing = null
      if (preset.isCustom) {
        existing = current.find(r => r.isCustom && r.itemName === preset.itemName)
      } else {
        existing = current.find(r => !r.isCustom && r.itemId === preset.itemId && r.printType === preset.printType && r.sides === preset.sides)
      }

      if (existing) {
        setTimeout(() => {
          setDuplicateWarning(`Incremented quantity for ${preset.name}.`)
          setTimeout(() => setDuplicateWarning(''), 3000)
        }, 0)
        return current.map(r => r.id === existing.id ? { ...r, qty: Number(r.qty) + 1, amount: Number(r.unitPrice) * (Number(r.qty) + 1) } : r)
      }

      let unitPrice = 0
      if (preset.isCustom) {
        unitPrice = preset.unitPrice
      } else {
        unitPrice = getItemBasePrice(preset.itemId, preset.printType, preset.sides)
      }

      const newRow = {
        id: `row-${Date.now()}-${Math.random()}`,
        itemId: preset.isCustom ? '' : preset.itemId,
        itemName: preset.isCustom ? preset.itemName : (inventory.find(i => i.id === preset.itemId)?.name || preset.name),
        isCustom: !!preset.isCustom,
        printType: preset.printType || 'color',
        sides: preset.sides || 'single',
        qty: 1,
        unitPrice,
        amount: unitPrice,
        gstRate: 0,
      }

      // Replace first empty/default row if untouched
      if (current.length === 1 && current[0].itemName === 'A4 Paper' && Number(current[0].qty) === 1 && Number(current[0].amount) === 10.0 && !current[0].isCustom && current[0].itemId === inventory[0]?.id) {
        return [newRow]
      }

      return [...current, newRow]
    })
  }

  // ── Promo Code Handling ───────────────────────────────────────────────────
  const handleApplyPromo = () => {
    setPromoError('')
    const code = promoCodeInput.trim().toUpperCase()
    if (!code) return

    const promo = promoCodes?.find(p => p.code === code)
    if (!promo) {
      setPromoError('Invalid promo code')
      return
    }
    if (promo.enabled === false) {
      setPromoError('This coupon code is currently disabled.')
      return
    }

    // Date validity check
    const billDate = date || new Date().toISOString().slice(0, 10)
    if (promo.startDate && billDate < promo.startDate) {
      setPromoError(`This coupon is only valid from ${promo.startDate}.`)
      return
    }
    if (promo.endDate && billDate > promo.endDate) {
      setPromoError(`This coupon expired on ${promo.endDate}.`)
      return
    }

    if (subtotal < promo.minAmount) {
      setPromoError(`Minimum bill amount for this code is ₹${promo.minAmount}`)
      return
    }
    setAppliedPromo(promo)
    setDiscountType(promo.type)
    setDiscountValue(promo.value)
    setPromoCodeInput('')
  }



  // ── WhatsApp receipt sharing ──────────────────────────────────────────────
  const shareOnWhatsApp = async (bill) => {
    const customer = customers.find(c => c.id === bill.customerId)
    const phone = customer?.phone || ''
    
    showToast('Generating and uploading PDF receipt...', 'info')
    let pdfUrl = ''
    try {
      const doc = await generateBillPDFDoc(bill)
      if (doc) {
        const pdfBlob = doc.output('blob')
        const uploadResult = await uploadPDFReceipt(pdfBlob, bill.id)
        if (uploadResult && uploadResult.fileUrl) {
          pdfUrl = uploadResult.fileUrl
          showToast('Receipt PDF ready to share!', 'success')
        }
      }
    } catch (err) {
      console.error('Failed to upload PDF for WhatsApp share:', err)
      showToast('Sharing message without PDF link due to upload issue.', 'warning')
    }

    const itemLines = bill.items.map(item => `• ${item.itemName || item.name} (${item.qty} qty) - ₹${Number(item.amount).toFixed(2)}`).join('%0A')
    const gstLines = (settings.showGstBreakdown !== false && bill.gstAmount > 0)
      ? `*CGST:* ₹${(bill.gstAmount / 2).toFixed(2)}%0A*SGST:* ₹${(bill.gstAmount / 2).toFixed(2)}%0A`
      : ''
    const loyaltyLines = (settings.loyaltyEnabled !== false)
      ? `*Loyalty Points Added:* +${bill.loyaltyPointsEarned || 0}%0A*Loyalty Balance:* ${bill.customerTotalLoyaltyPoints || 0} pts%0A`
      : ''
    const discountLine = bill.discountAmount > 0 ? `*Discount:* -₹${bill.discountAmount.toFixed(2)}%0A` : ''
    const loyaltyDiscountLine = Number(bill.loyaltyPointsRedeemed) > 0
      ? `*Loyalty Discount:* -₹${(bill.loyaltyPointsRedeemed * (settings.loyaltyRedeemRatioRupees || 5) / (settings.loyaltyRedeemRatioPoints || 150)).toFixed(2)}%0A`
      : ''
    const pdfUrlLine = pdfUrl ? `*Download PDF Receipt:* ${pdfUrl}%0A` : ''

    const text = `*Invoice from ${business?.shopName || 'PrintPro'}*%0A` +
      `*Bill ID:* ${bill.id}%0A` +
      `*Date:* ${bill.date}%0A` +
      `*Customer:* ${bill.customerName}%0A` +
      `------------------------%0A` +
      `${itemLines}%0A` +
      `------------------------%0A` +
      `*Subtotal:* ₹${bill.subtotal.toFixed(2)}%0A` +
      gstLines +
      discountLine +
      loyaltyDiscountLine +
      `*Total:* *₹${bill.total.toFixed(2)}*%0A` +
      `*Paid:* ₹${bill.amountPaid.toFixed(2)}%0A` +
      (bill.balance > 0 ? `*Balance Due:* *₹${bill.balance.toFixed(2)}*%0A` : `*Status:* PAID%0A`) +
      `------------------------%0A` +
      loyaltyLines +
      pdfUrlLine +
      `%0AThank you for your business!`

    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`
    window.open(url, '_blank')
  }

  // ── Thermal POS printer popup receipt ──────────────────────────────────────
  const printPOSReceipt = (bill) => {
    const upiLink = getUpiLink(bill.balance)
    const qrCodeUrl = (settings.showUpiQrCode !== false && bill.balance > 0 && upiLink)
      ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiLink)}`
      : ''
    
    const popup = window.open('', '_blank', 'width=350,height=600')
    popup.document.write(`
      <html>
        <head>
          <title>POS Receipt #${bill.id}</title>
          <style>
            @media print {
              body { margin: 0; padding: 10px; }
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              color: #000;
              margin: 0;
              padding: 20px;
              width: 76mm;
              box-sizing: border-box;
            }
            .header { text-align: center; margin-bottom: 15px; }
            .shop-name { font-size: 16px; font-weight: bold; color: ${settings.primaryColor || '#000'}; margin: 0; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .details-table { width: 100%; border-collapse: collapse; }
            .details-table td { padding: 2px 0; }
            .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .items-table th { text-align: left; border-bottom: 1px dashed #000; padding: 4px 0; }
            .items-table td { padding: 4px 0; }
            .right { text-align: right; }
            .totals { margin-top: 10px; }
            .totals-row { display: flex; justify-content: space-between; padding: 2px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 11px; }
            .qr-container { text-align: center; margin-top: 15px; }
            .qr-code { width: 120px; height: 120px; border: 1px solid #000; padding: 2px; }
            .logo-img { max-height: 50px; max-width: 120px; object-fit: contain; margin-bottom: 8px; }
            .custom-note { font-size: 10px; font-style: italic; margin-top: 4px; color: #333; }
          </style>
        </head>
        <body>
          <div class="header">
            \${settings.logoUrl ? \`<img class="logo-img" src="\${settings.logoUrl}" alt="logo" />\` : ''}
            <p class="shop-name">\${business?.shopName || 'PrintPro'}</p>
            <p style="margin: 3px 0;">\${business?.address || ''}</p>
            <p style="margin: 3px 0;">Ph: \${business?.phone || ''}</p>
            \${business?.gstin ? \`<p style="margin: 3px 0;">GSTIN: \${business.gstin}</p>\` : ''}
            \${settings.headerNotes ? \`<p class="custom-note">\${settings.headerNotes}</p>\` : ''}
          </div>
          <div class="divider"></div>
          <table class="details-table">
            <tr><td>Bill ID:</td><td class="right">\${bill.id}</td></tr>
            <tr><td>Date:</td><td class="right">\${bill.date}</td></tr>
            <tr><td>Customer:</td><td class="right">\${bill.customerName}</td></tr>
            <tr><td>Status:</td><td class="right" style="text-transform: uppercase;">\${bill.status}</td></tr>
          </table>
          <div class="divider"></div>
          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="right">Qty</th>
                <th class="right">Amt</th>
              </tr>
            </thead>
            <tbody>
              \${bill.items.map(item => \`
                <tr>
                  <td>\${item.itemName || item.name}</td>
                  <td class="right">\${item.qty}</td>
                  <td class="right">₹\${Number(item.amount).toFixed(2)}</td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
          <div class="divider"></div>
          <div class="totals">
            <div class="totals-row"><span>Subtotal:</span><span>₹\${bill.subtotal.toFixed(2)}</span></div>
            \${settings.showGstBreakdown !== false && bill.gstAmount > 0 ? \`
              <div class="totals-row"><span>CGST:</span><span>₹\${(bill.gstAmount / 2).toFixed(2)}</span></div>
              <div class="totals-row"><span>SGST:</span><span>₹\${(bill.gstAmount / 2).toFixed(2)}</span></div>
            \` : ''}
            \${bill.promoCode ? \`
               <div class="totals-row"><span>Promo Code (\${bill.promoCode}):</span><span>-₹\${(bill.promoDiscount || bill.discountAmount || 0).toFixed(2)}</span></div>
             \` : (bill.discountAmount > 0 ? \`<div class="totals-row"><span>Discount:</span><span>-₹\${bill.discountAmount.toFixed(2)}</span></div>\` : '')}
             \${Number(bill.loyaltyPointsRedeemed) > 0 ? \`
               <div class="totals-row"><span>Loyalty Discount (\${bill.loyaltyPointsRedeemed} pts):</span><span>-₹\${(bill.loyaltyDiscount || (bill.loyaltyPointsRedeemed * (settings.loyaltyRedeemRatioRupees || 5) / (settings.loyaltyRedeemRatioPoints || 150))).toFixed(2)}</span></div>
             \` : ''}
            <div class="totals-row" style="font-weight: bold; color: ${settings.primaryColor || '#000'};"><span>Total:</span><span>₹\${bill.total.toFixed(2)}</span></div>
            <div class="totals-row"><span>Paid:</span><span>₹\${bill.amountPaid.toFixed(2)}</span></div>
            \${bill.balance > 0 ? \`
              <div class="totals-row" style="color: red; font-weight: bold;"><span>Balance Due:</span><span>₹\${bill.balance.toFixed(2)}</span></div>
            \` : ''}
          </div>
          
          \${settings.loyaltyEnabled !== false ? \`
            <div class="divider"></div>
            <div style="font-size: 10px; font-weight: bold;">
              <div class="totals-row"><span>Points Added:</span><span>+\${bill.loyaltyPointsEarned || 0}</span></div>
              <div class="totals-row"><span>Total Balance:</span><span>\${bill.customerTotalLoyaltyPoints || 0} pts</span></div>
            </div>
          \` : ''}

          \${bill.balance > 0 && qrCodeUrl ? \`
            <div class="qr-container">
              <p style="margin: 0 0 5px 0; font-size: 10px;">Scan QR to Pay Balance</p>
              <img class="qr-code" src="\${qrCodeUrl}" alt="UPI QR" />
            </div>
          \` : ''}
          <div class="divider"></div>
          \${settings.footerNotes ? \`<p class="custom-note" style="text-align: center; margin-bottom: 8px;">\${settings.footerNotes}</p>\` : ''}
          <div class="footer">
            <p style="font-weight: bold;">Thank You for visiting!</p>
            <p style="margin-top: 5px; font-size: 9px;">Powered by PrintPro</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    popup.document.close();
  }

  // ── Inventory price lookup ─────────────────────────────────────────────────
  const getItemBasePrice = (itemId, printType, sides) => {
    const item = inventory.find((e) => e.id === itemId)
    if (!item) return 0
    if (printType === 'color' && sides === 'single') return item.colorSingle
    if (printType === 'color' && sides === 'double') return item.colorDouble
    if (printType === 'bw' && sides === 'single') return item.bwSingle
    if (printType === 'bw' && sides === 'double') return item.bwDouble
    return 0
  }

  // ── Duplicate-combo detection (Bug 6b) ────────────────────────────────────
  const findDuplicateRow = (rows, itemId, printType, sides, excludeRowId = null) => {
    return rows.find(
      (r) =>
        r.id !== excludeRowId &&
        !r.isCustom &&
        r.itemId === itemId &&
        r.printType === printType &&
        r.sides === sides
    )
  }

  // ── Row update helpers ─────────────────────────────────────────────────────
  const updateRow = (rowId, changes) => {
    setItemRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row
        const unitPrice = changes.unitPrice !== undefined ? Number(changes.unitPrice) : row.unitPrice
        const qty = changes.qty !== undefined ? Number(changes.qty) : row.qty
        return { ...row, ...changes, unitPrice, qty, amount: unitPrice * qty }
      })
    )
  }

  const updateRowItem = (rowId, updates) => {
    setItemRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row
        const unitPrice = updates.unitPrice ?? row.unitPrice
        const qty = updates.qty ?? row.qty
        return { ...row, ...updates, unitPrice, qty, amount: unitPrice * qty }
      })
    )
  }

  // When a combo-select changes, check for duplicates and merge if needed
  const handleComboChange = (rowId, changes) => {
    setDuplicateWarning('')
    setItemRows((current) => {
      const targetRow = current.find((r) => r.id === rowId)
      if (!targetRow || targetRow.isCustom) {
        // Just update normally
        return current.map((r) => {
          if (r.id !== rowId) return r
          const unitPrice = changes.unitPrice ?? r.unitPrice
          const qty = r.qty
          return { ...r, ...changes, unitPrice, amount: unitPrice * qty }
        })
      }

      const newItemId = changes.itemId ?? targetRow.itemId
      const newPrintType = changes.printType ?? targetRow.printType
      const newSides = changes.sides ?? targetRow.sides
      const dupRow = current.find(
        (r) =>
          r.id !== rowId &&
          !r.isCustom &&
          r.itemId === newItemId &&
          r.printType === newPrintType &&
          r.sides === newSides
      )

      if (dupRow) {
        // Merge: increment qty on duplicate, remove current row
        setTimeout(() => {
          setDuplicateWarning('Quantity updated for duplicate item.')
          setTimeout(() => setDuplicateWarning(''), 3000)
        }, 0)
        return current
          .filter((r) => r.id !== rowId)
          .map((r) => {
            if (r.id !== dupRow.id) return r
            const qty = r.qty + targetRow.qty
            return { ...r, qty, amount: r.unitPrice * qty }
          })
      }

      // No duplicate — normal update
      const unitPrice =
        changes.unitPrice !== undefined
          ? Number(changes.unitPrice)
          : changes.itemId || changes.printType || changes.sides
          ? getItemBasePrice(newItemId, newPrintType, newSides)
          : targetRow.unitPrice
      const qty = targetRow.qty
      return current.map((r) => {
        if (r.id !== rowId) return r
        return { ...r, ...changes, unitPrice, amount: unitPrice * qty }
      })
    })
  }

  const addRow = () => {
    setDuplicateWarning('')
    let defaultItemId = inventory[0]?.id || ''
    let defaultPrintType = 'color'
    let defaultSides = 'single'
    let defaultItemName = inventory[0]?.name || 'Custom Item'

    // Find a combination of (item, printType, sides) that is NOT already in itemRows
    let foundUnused = false
    const combos = [
      { printType: 'color', sides: 'single' },
      { printType: 'color', sides: 'double' },
      { printType: 'bw', sides: 'single' },
      { printType: 'bw', sides: 'double' }
    ]

    for (const item of inventory) {
      for (const combo of combos) {
        const exists = itemRows.some(
          (r) => !r.isCustom && r.itemId === item.id && r.printType === combo.printType && r.sides === combo.sides
        )
        if (!exists) {
          defaultItemId = item.id
          defaultPrintType = combo.printType
          defaultSides = combo.sides
          defaultItemName = item.name
          foundUnused = true
          break
        }
      }
      if (foundUnused) break
    }

    // If all possible combos exist, fallback to the first combo and increment its qty
    if (!foundUnused) {
      const dupRow = itemRows.find(
        (r) => !r.isCustom && r.itemId === defaultItemId && r.printType === defaultPrintType && r.sides === defaultSides
      )
      if (dupRow) {
        setItemRows((current) =>
          current.map((r) => {
            if (r.id !== dupRow.id) return r
            const qty = r.qty + 1
            return { ...r, qty, amount: r.unitPrice * qty }
          })
        )
        setDuplicateWarning('Quantity increased for existing item.')
        setTimeout(() => setDuplicateWarning(''), 3000)
        return
      }
    }

    const unitPrice = getItemBasePrice(defaultItemId, defaultPrintType, defaultSides)
    setItemRows((current) => [
      ...current,
      {
        id: `row-${Date.now()}-${Math.random()}`,
        itemId: defaultItemId,
        itemName: defaultItemName,
        isCustom: false,
        printType: defaultPrintType,
        sides: defaultSides,
        qty: 1,
        unitPrice,
        amount: unitPrice,
      },
    ])
  }

  const addCustomRow = () => {
    setItemRows((current) => [
      ...current,
      {
        id: `row-${Date.now()}`,
        itemId: '',
        itemName: '',
        isCustom: true,
        printType: 'color',
        sides: 'single',
        qty: 1,
        unitPrice: 0,
        amount: 0,
        gstRate: 0,
      },
    ])
  }

  const removeRow = (rowId) => {
    setItemRows((current) => current.filter((r) => r.id !== rowId))
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const subtotal = itemRows.reduce((sum, r) => sum + Number(r.amount || 0), 0)
  const autoGst = itemRows.reduce((sum, r) => sum + (Number(r.amount || 0) * (Number(r.gstRate || 0) / 100)), 0)
  const totalGst = customGst !== '' ? Number(customGst) : autoGst
  const cgst = totalGst / 2
  const sgst = totalGst / 2
  const discountAmount =
    discountType === 'percent'
      ? (subtotal * Number(discountValue || 0)) / 100
      : Number(discountValue || 0)

  // Loyalty Points Discount calculation
  const loyaltyEnabled = settings.loyaltyEnabled !== false
  const pointsRedeemed = loyaltyEnabled && customerType === 'regular' ? Number(loyaltyPointsRedeemedInput || 0) : 0
  const redeemOptions = settings.loyaltyRedeemOptions || [
    { points: 100, rupees: 2.5 },
    { points: 120, rupees: 3 },
    { points: 150, rupees: 5 },
  ]
  const selectedRedeemOpt = redeemOptions.find(o => Number(o.points) === pointsRedeemed)
  const loyaltyDiscount = loyaltyEnabled && selectedRedeemOpt ? Number(selectedRedeemOpt.rupees) : 0

  const total = Math.max(subtotal + totalGst - discountAmount - loyaltyDiscount, 0)
  const amountPaid = Number(cashAmount || 0) + Number(upiAmount || 0)
  const customerCredit = Number(selectedCustomer?.creditBalance || 0)
  const customerAdvance = Number(selectedCustomer?.advanceBalance || 0)
  const appliedAdvance = Math.min(Number(advanceUsed || 0), customerAdvance, total)
  const excessPaid = Math.max(amountPaid - Math.max(total - appliedAdvance, 0), 0)
  const netBalance = Math.max(total - appliedAdvance - amountPaid, 0)
  const finalStatus =
    amountPaid + appliedAdvance >= total ? 'paid'
    : amountPaid + appliedAdvance > 0 ? 'partial'
    : 'unpaid'

  // Auto-detect and apply available advance payments
  React.useEffect(() => {
    if (selectedCustomer) {
      const maxAdv = Math.min(Number(selectedCustomer.advanceBalance || 0), total)
      setAdvanceUsed(Number(maxAdv.toFixed(2)))
    } else {
      setAdvanceUsed(0)
    }
  }, [selectedCustomer, total])

  // Promo code validation effect (after subtotal is declared to avoid TDZ error)
  useEffect(() => {
    if (appliedPromo && subtotal < appliedPromo.minAmount) {
      setAppliedPromo(null)
      setDiscountValue(0)
      setPromoError(`Promo code ${appliedPromo.code} removed (subtotal fell below ₹${appliedPromo.minAmount})`)
      setTimeout(() => setPromoError(''), 4000)
    }
  }, [subtotal, appliedPromo])

  const handleEditBill = (bill) => {
    setIsEditing(true)
    setEditingBillId(bill.id)
    setCustomerType(bill.customerType || 'regular')
    if (bill.customerType === 'regular') {
      setCustomerId(bill.customerId)
    } else {
      setRandomMode('existing')
      setRandomCustomerId(bill.customerId)
    }
    setDate(bill.date)
    setDueDate(bill.dueDate || '')
    setItemRows(bill.items.map((item) => ({
      id: item.id || `row-${Date.now()}-${Math.random()}`,
      itemId: item.itemId || '',
      itemName: item.itemName || item.name,
      isCustom: !item.itemId,
      printType: item.printType,
      sides: item.sides,
      qty: item.qty,
      unitPrice: item.unitPrice,
      amount: item.amount,
      gstRate: item.gstRate || 0,
    })))
    setDiscountType(bill.discountType || 'flat')
    setDiscountValue(bill.discountValue || 0)
    setCustomGst(bill.gstAmount !== undefined && bill.gstAmount !== null ? String(bill.gstAmount) : '')
    setCashAmount(bill.paymentMethod?.cash || 0)
    setUpiAmount(bill.paymentMethod?.upi || 0)
    setNotes(bill.notes || '')
    setPaymentMode(bill.status === 'paid' ? 'full' : 'partial')
    setLoyaltyPointsRedeemedInput(String(bill.loyaltyPointsRedeemed || ''))
    setIsModalOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Customer type change ───────────────────────────────────────────────────
  const handleCustomerTypeChange = (type) => {
    setCustomerType(type)
    setAdvanceUsed(0)
    if (type === 'regular') {
      const first = customers.find((c) => c.type === 'regular' && !c.deleted)
      setCustomerId(first?.id || '')
      setRandomCustomerId('')
      setRandomMode('existing')
    } else {
      setCustomerId('')
      setRandomCustomerId(customers.find((c) => c.type === 'random' && !c.deleted)?.id || '')
      setRandomMode('existing')
    }
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
  }

  const processEditBillSave = (finalPayload) => {
    const oldBill = bills.find(b => b.id === editingBillId)
    const oldPaidCash = oldBill?.paymentMethod?.cash || 0
    const oldPaidUpi = oldBill?.paymentMethod?.upi || 0
    const oldPaidDirect = oldPaidCash + oldPaidUpi
    const oldAdvanceUsed = oldBill?.advanceUsed || 0
    const oldPaidTotal = oldPaidDirect + oldAdvanceUsed

    if (oldPaidTotal > finalPayload.total) {
      const refundDue = oldPaidTotal - finalPayload.total
      const advanceRefund = Math.min(oldAdvanceUsed, refundDue)
      const directRefund = refundDue - advanceRefund

      setRefundInfo({
        oldPaidTotal,
        oldPaidDirect,
        oldAdvanceUsed,
        refundDue,
        advanceRefund,
        directRefund,
        billPayload: finalPayload
      })
      setRefundMethod(oldPaidUpi > oldPaidCash ? 'upi' : 'cash')
      setRefundChoice('direct')
      setRefundQrGenerated(false)
      setShowRefundModal(true)
    } else {
      editBill(editingBillId, finalPayload)
      setIsEditing(false)
      setEditingBillId(null)
      resetForm()
    }
  }

  const handleConfirmRefund = () => {
    if (!refundInfo) return

    const refundAction = {
      type: refundChoice,
      method: refundMethod,
      directAmount: refundInfo.directRefund,
      advanceAmount: refundInfo.advanceRefund,
    }

    editBill(editingBillId, refundInfo.billPayload, refundAction)
    setShowRefundModal(false)
    setRefundInfo(null)
    setCustomerUpiId('')
    setRefundQrGenerated(false)
    setIsEditing(false)
    setEditingBillId(null)
    resetForm()
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = (event) => {
    event.preventDefault()
    let customerIdToUse = ''
    let customerNameToUse = ''

    if (customerType === 'regular') {
      if (!customerId) { showAlert('Please select a regular customer.', 'error'); return }
      customerIdToUse = customerId
      customerNameToUse = selectedCustomer?.name || ''
    } else {
      if (randomMode === 'existing') {
        if (!randomCustomerId) { showAlert('Please select a walk-in customer or choose "New Customer".', 'error'); return }
        customerIdToUse = randomCustomerId
        const c = customers.find((x) => x.id === randomCustomerId)
        customerNameToUse = c?.name || 'Walk-in Customer'
      } else {
        if (!customerName.trim()) { showAlert('Please enter the customer name.', 'error'); return }
        customerNameToUse = customerName.trim()
        customerIdToUse = addCustomer({
          type: 'random',
          name: customerNameToUse,
          phone: customerPhone.trim(),
          email: customerEmail.trim(),
          creditBalance: 0,
        })
      }
    }

    // Merge duplicate items before submission (Part 3 requirement pass)
    const mergedItemRows = []
    itemRows.forEach((row) => {
      const existing = mergedItemRows.find(
        (item) =>
          !row.isCustom &&
          !item.isCustom &&
          item.itemId === row.itemId &&
          item.printType === row.printType &&
          item.sides === row.sides &&
          Number(item.gstRate || 0) === Number(row.gstRate || 0)
      )
      if (existing) {
        existing.qty += Number(row.qty)
        existing.amount = existing.qty * existing.unitPrice
      } else {
        mergedItemRows.push({ ...row, qty: Number(row.qty) })
      }
    })

    const totalPaidNow = Number(cashAmount || 0) + Number(upiAmount || 0)
    const changeDue = totalPaidNow - total

    let finalCashAmount = Number(cashAmount || 0)
    let finalUpiAmount = Number(upiAmount || 0)
    let finalAmountPaid = amountPaid

    if (changeDue > 0) {
      if (changeHandling === 'upi_refund') {
        finalUpiAmount = Number((finalUpiAmount - changeDue).toFixed(2))
        finalAmountPaid = total
      } else if (changeHandling === 'cash_refund') {
        finalCashAmount = Number((finalCashAmount - changeDue).toFixed(2))
        finalAmountPaid = total
      }
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
      discountAmount,
      gstAmount: totalGst,
      cgst: cgst,
      sgst: sgst,
      total,
      rounding: 0,
      cashAmount: finalCashAmount,
      upiAmount: finalUpiAmount,
      amountPaid: finalAmountPaid,
      advanceUsed: appliedAdvance,
      notes,
      paymentMode,
      promoCode: appliedPromo?.code || null,
      promoDiscount: appliedPromo ? discountAmount : 0,
      loyaltyDiscount: loyaltyDiscount,
      loyaltyPointsRedeemed: Number(loyaltyPointsRedeemedInput || 0),
      items: mergedItemRows.map((row) => ({
        itemId: row.itemId,
        itemName: row.itemName,
        printType: row.printType,
        sides: row.sides,
        qty: Number(row.qty),
        unitPrice: Number(row.unitPrice),
        amount: Number(row.amount),
        gstRate: Number(row.gstRate || 0),
      })),
    }

    if (isEditing) {
      const updatedPayload = { ...billPayload, id: editingBillId }
      const decimalPart = total - Math.floor(total)
      if (decimalPart > 0 && decimalPart < 1) {
        setPendingBillPayload(updatedPayload)
        setShowRoundingModal(true)
        return
      }
      processEditBillSave(updatedPayload)
      return
    }

    // Check for decimal in total — offer rounding
    const decimalPart = total - Math.floor(total)
    if (decimalPart > 0 && decimalPart < 1) {
      setPendingBillPayload(billPayload)
      setShowRoundingModal(true)
      return
    }

    const newBillId = addBill(billPayload)
    setLastBillId(newBillId)
    resetForm()
  }

  const resetForm = () => {
    setIsEditing(false)
    setEditingBillId(null)
    setCustomerType('regular')
    setCustomerId(customers.find((c) => c.type === 'regular' && !c.deleted)?.id || '')
    setRandomCustomerId('')
    setRandomMode('existing')
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
    setAdvanceUsed(0)
    setItemRows([makeInitialRow(inventory)])
    setDiscountType('flat')
    setDiscountValue(0)
    setCustomGst('')
    setCashAmount(0)
    setUpiAmount(0)
    setNotes('')
    setPaymentMode('partial')
    setDuplicateWarning('')
    setLoyaltyPointsRedeemedInput('')
    setShouldRedeemPoints(false)
    setChangeHandling('advance')
  }

  const handleRoundingChoice = (roundedTotal) => {
    if (!pendingBillPayload) return
    const originalTotal = pendingBillPayload.total
    const diff = roundedTotal - originalTotal
    const finalPayload = {
      ...pendingBillPayload,
      total: roundedTotal,
      rounding: Number(diff.toFixed(2)),
      roundingNote: diff !== 0 ? `Rounded ${diff < 0 ? 'down' : 'up'} from ₹${originalTotal.toFixed(2)} to ₹${roundedTotal.toFixed(2)}` : '',
    }
    setShowRoundingModal(false)
    setPendingBillPayload(null)
    
    if (isEditing) {
      processEditBillSave(finalPayload)
    } else {
      const newBillId = addBill(finalPayload)
      setLastBillId(newBillId)
      resetForm()
    }
  }

  // ── Post-bill discount ────────────────────────────────────────────────────
  const handleApplyPostDiscount = () => {
    if (!liveBill) return
    const dVal = Number(discountModalValue || 0)
    applyPostDiscount(liveBill.id, discountModalType, dVal)
    setDiscountApplyMsg('Discount applied successfully!')
    setTimeout(() => setDiscountApplyMsg(''), 3000)
  }

  const getQrCodeBase64 = (upiLink) => {
    return new Promise((resolve) => {
      if (!upiLink) {
        resolve('')
        return
      }
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiLink)}`
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0)
          resolve(canvas.toDataURL('image/png'))
        } catch (err) {
          console.error("Failed to convert QR code to base64", err)
          resolve('')
        }
      }
      img.onerror = () => {
        resolve('')
      }
    })
  }

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#0f172a')
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 15, g: 23, b: 42 }
  }

  // ── PDF download (programmatic jsPDF, no html2canvas) ─────────────────────
  const generateBillPDFDoc = async (billToUse) => {
    const bill = billToUse || liveBill
    if (!bill) return null
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()
    const MARGIN = 10
    const FOOTER_H = 14
    const MAX_Y = H - MARGIN - FOOTER_H
    let y = 15
    let page = 1

    const rgb = hexToRgb(settings.primaryColor)

    const line = (x1, y1, x2, y2, width = 0.3) => {
      doc.setLineWidth(width)
      doc.line(x1, y1, x2, y2)
    }
    const text = (str, x, yPos, opts) => doc.text(String(str), x, yPos, opts)

    const addFooter = (pageNum, totalPages) => {
      const fy = H - MARGIN
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text('Thank you for your business!', W / 2, fy - 4, { align: 'center' })
      doc.text(`Page ${pageNum} of ${totalPages}`, W / 2, fy, { align: 'center' })
      doc.setTextColor(0, 0, 0)
    }

    const checkNewPage = (neededSpace = 8) => {
      if (y + neededSpace > MAX_Y) {
        addFooter(page, '?')
        doc.addPage()
        page++
        y = 15
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        text('(continued)', W / 2, y, { align: 'center' })
        y += 6
        text('Item', cols.item, y)
        text('Type', cols.type, y)
        text('Sides', cols.sides, y)
        text('Qty', cols.qty, y)
        text('Unit Price', cols.unit, y)
        text('Amount', cols.amt, y)
        y += 2
        doc.setDrawColor(rgb.r, rgb.g, rgb.b)
        line(MARGIN, y, W - MARGIN, y, 0.4)
        y += 5
        doc.setFont('helvetica', 'normal')
        return true
      }
      return false
    }

    // Logo (if any)
    if (settings.logoUrl) {
      try {
        doc.addImage(settings.logoUrl, 'PNG', (W - 30) / 2, y, 30, 15)
        y += 18
      } catch (e) {
        console.error("Failed to add logo to PDF", e)
      }
    }

    // Header Shop Info
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(rgb.r, rgb.g, rgb.b)
    text(business?.shopName || 'PrintPro', W / 2, y, { align: 'center' })
    y += 6
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(50, 50, 50)
    if (business?.address) { text(business.address, W / 2, y, { align: 'center' }); y += 5 }
    if (business?.gstin) { text(`GSTIN: ${business.gstin}`, W / 2, y, { align: 'center' }); y += 5 }
    if (business?.phone) { text(`Ph: ${business.phone}`, W / 2, y, { align: 'center' }); y += 5 }
    
    // Custom Header Notes
    if (settings.headerNotes) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      text(settings.headerNotes, W / 2, y, { align: 'center' })
      y += 5
    }

    y += 2
    doc.setDrawColor(rgb.r, rgb.g, rgb.b)
    line(MARGIN, y, W - MARGIN, y, 0.6)
    y += 6

    // Bill info
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(rgb.r, rgb.g, rgb.b)
    text('TAX INVOICE', W / 2, y, { align: 'center' })
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(50, 50, 50)
    text(`Bill ID: ${bill.id}`, MARGIN, y)
    text(`Date: ${bill.date}`, W - MARGIN, y, { align: 'right' })
    y += 5
    text(`Customer: ${bill.customerName}`, MARGIN, y)
    text(`Due: ${bill.dueDate}`, W - MARGIN, y, { align: 'right' })
    y += 5
    text(`Status: ${bill.status.toUpperCase()}`, MARGIN, y)
    y += 3
    doc.setDrawColor(rgb.r, rgb.g, rgb.b)
    line(MARGIN, y, W - MARGIN, y, 0.3)
    y += 6

    // Items table header
    const cols = { item: MARGIN, type: 78, sides: 100, qty: 122, unit: 142, amt: 168 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    text('Item', cols.item, y)
    text('Type', cols.type, y)
    text('Sides', cols.sides, y)
    text('Qty', cols.qty, y)
    text('Unit Price', cols.unit, y)
    text('Amount', cols.amt, y)
    y += 2
    doc.setDrawColor(rgb.r, rgb.g, rgb.b)
    line(MARGIN, y, W - MARGIN, y, 0.4)
    y += 5

    // Items
    doc.setFont('helvetica', 'normal')
    bill.items.forEach((item) => {
      checkNewPage(8)
      text(item.itemName || item.name || '-', cols.item, y)
      text(item.printType === 'color' ? 'Color' : 'B/W', cols.type, y)
      text(item.sides === 'single' ? 'Single' : 'Double', cols.sides, y)
      text(String(item.qty), cols.qty, y)
      text(`Rs.${Number(item.unitPrice).toFixed(2)}`, cols.unit, y)
      text(`Rs.${Number(item.amount).toFixed(2)}`, cols.amt, y)
      y += 6
    })
    y += 2
    doc.setDrawColor(rgb.r, rgb.g, rgb.b)
    line(MARGIN, y, W - MARGIN, y, 0.4)
    y += 6

    // Totals
    const labelX = W - 65
    const valX = W - MARGIN
    checkNewPage(30)
    doc.setFontSize(9)
    text('Subtotal:', labelX, y); text(`Rs.${bill.subtotal.toFixed(2)}`, valX, y, { align: 'right' }); y += 5
    
    if (settings.showGstBreakdown !== false && bill.gstAmount > 0) {
      text('CGST:', labelX, y); text(`Rs.${(bill.gstAmount / 2).toFixed(2)}`, valX, y, { align: 'right' }); y += 5
      text('SGST:', labelX, y); text(`Rs.${(bill.gstAmount / 2).toFixed(2)}`, valX, y, { align: 'right' }); y += 5
    }
    
    if (Number(bill.discountAmount || bill.discountValue) > 0) {
      text('Discount:', labelX, y); text(`-Rs.${Number(bill.discountAmount || bill.discountValue).toFixed(2)}`, valX, y, { align: 'right' }); y += 5
    }
    
    if (Number(bill.loyaltyPointsRedeemed) > 0) {
      const ptVal = (settings.loyaltyRedeemRatioRupees || 5) / (settings.loyaltyRedeemRatioPoints || 150)
      const loyaltyDisc = bill.loyaltyPointsRedeemed * ptVal
      text('Loyalty Discount:', labelX, y); text(`-Rs.${loyaltyDisc.toFixed(2)}`, valX, y, { align: 'right' }); y += 5
    }

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(rgb.r, rgb.g, rgb.b)
    text('Total:', labelX, y); text(`Rs.${bill.total.toFixed(2)}`, valX, y, { align: 'right' }); y += 5
    doc.setTextColor(50, 50, 50)
    doc.setFont('helvetica', 'normal')
    text('Amount Paid:', labelX, y); text(`Rs.${bill.amountPaid.toFixed(2)}`, valX, y, { align: 'right' }); y += 5
    if (bill.balance > 0) {
      doc.setTextColor(239, 68, 68)
      text('Balance Due:', labelX, y); text(`Rs.${bill.balance.toFixed(2)}`, valX, y, { align: 'right' }); y += 5
      doc.setTextColor(50, 50, 50)
    }
    y += 3
    doc.setDrawColor(rgb.r, rgb.g, rgb.b)
    line(MARGIN, y, W - MARGIN, y, 0.3)
    y += 6

    // Loyalty points summary
    if (settings.loyaltyEnabled !== false) {
      checkNewPage(12)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(rgb.r, rgb.g, rgb.b)
      text(`Loyalty Points Added: +${bill.loyaltyPointsEarned || 0}`, MARGIN, y)
      text(`Total Loyalty Balance: ${bill.customerTotalLoyaltyPoints || 0} pts`, W - MARGIN, y, { align: 'right' })
      y += 6
      doc.setTextColor(50, 50, 50)
      doc.setFont('helvetica', 'normal')
      line(MARGIN, y, W - MARGIN, y, 0.3)
      y += 6
    }

    // Payment breakdown & QR code
    const upiLink = getUpiLink(bill.balance)
    const qrBase64 = (settings.showUpiQrCode !== false && bill.balance > 0) 
      ? await getQrCodeBase64(upiLink) 
      : ''

    if (qrBase64) {
      checkNewPage(35)
      const qrSize = 25
      doc.addImage(qrBase64, 'PNG', W - MARGIN - qrSize, y, qrSize, qrSize)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      text('Scan QR to Pay Balance', W - MARGIN - qrSize + qrSize/2, y + qrSize + 3, { align: 'center' })
      
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      text('Payment Breakdown:', MARGIN, y); y += 4
      doc.setFont('helvetica', 'normal')
      text(`Cash: Rs.${(bill.paymentMethod?.cash || 0).toFixed(2)}`, MARGIN, y); y += 4
      text(`UPI: Rs.${(bill.paymentMethod?.upi || 0).toFixed(2)}`, MARGIN, y); y += 4
      if (bill.advanceUsed > 0) {
        text(`Advance Used: Rs.${bill.advanceUsed.toFixed(2)}`, MARGIN, y); y += 4
      }
      y = Math.max(y, y - 16 + qrSize + 6)
    } else {
      checkNewPage(18)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      text('Payment Breakdown:', MARGIN, y); y += 5
      doc.setFont('helvetica', 'normal')
      text(`Cash: Rs.${(bill.paymentMethod?.cash || 0).toFixed(2)}`, MARGIN, y)
      text(`UPI: Rs.${(bill.paymentMethod?.upi || 0).toFixed(2)}`, 70, y)
      y += 5
      if (bill.advanceUsed > 0) {
        text(`Advance Used: Rs.${bill.advanceUsed.toFixed(2)}`, 130, y - 5)
      }
      y += 5
    }

    // Custom Footer Notes
    if (settings.footerNotes) {
      checkNewPage(14)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(100, 100, 100)
      const splitFooterNotes = doc.splitTextToSize(settings.footerNotes, W - MARGIN * 2)
      doc.text(splitFooterNotes, MARGIN, y)
      y += splitFooterNotes.length * 4 + 4
      doc.setTextColor(0, 0, 0)
    }

    // Write footer
    const totalPages = page
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      addFooter(p, totalPages)
    }

    return doc
  }

  const downloadBillPDF = async () => {
    const doc = await generateBillPDFDoc(liveBill)
    if (doc) {
      doc.save(`${liveBill.id || 'invoice'}.pdf`)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Billing</h1>
        <p>Create orders with full split payment, discount and credit handling.</p>
      </div>

      {lastBillId && successBill ? (
        <BillSuccessScreen
          bill={successBill}
          onDownload={() => downloadBillPDF(successBill)}
          onWhatsApp={() => shareOnWhatsApp(successBill)}
          onPrint={async () => {
            const doc = await generateBillPDFDoc(successBill)
            if (doc) {
              doc.autoPrint()
              const hUri = doc.output('bloburl')
              window.open(hUri, '_blank')
            }
          }}
          onCreateNew={() => setLastBillId(null)}
        />
      ) : (
        <form className="card" onSubmit={handleSubmit}>
        <div className="bill-view-header">
          <div>
            {isEditing ? (
              <>
                <h2 style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px' }}><Pencil size={20} /> Edit Bill: <span style={{ fontFamily: 'monospace' }}>{editingBillId}</span></h2>
                <p className="text-muted">Modify items, discount, and payment. All prior payments for this bill will be recalculated.</p>
              </>
            ) : (
              <>
                <h2>New Print Bill</h2>
                <p className="text-muted">Build the bill, add items, and handle cash/UPI payments.</p>
              </>
            )}
          </div>
          {isEditing && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setIsEditing(false); setEditingBillId(null); resetForm() }}
            >
              <X size={16} /> Cancel Edit
            </button>
          )}
        </div>

        {duplicateWarning && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 14px', marginBottom: '12px',
            background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 'var(--radius-md)', color: 'var(--warning)', fontSize: '0.875rem'
          }}>
            <AlertTriangle size={16} /> {duplicateWarning}
          </div>
        )}

        <div className="grid-2" style={{ gap: '20px' }}>
          {/* Customer Type toggle */}
          <div className="form-group">
            <label className="form-label">Customer Type</label>
            <div className="radio-group">
              <label className={`radio-option ${customerType === 'regular' ? 'selected' : ''}`}>
                <input type="radio" name="customerType" value="regular" checked={customerType === 'regular'} onChange={() => handleCustomerTypeChange('regular')} />
                Regular
              </label>
              <label className={`radio-option ${customerType === 'random' ? 'selected' : ''}`}>
                <input type="radio" name="customerType" value="random" checked={customerType === 'random'} onChange={() => handleCustomerTypeChange('random')} />
                Walk-in / Random
              </label>
            </div>
          </div>

          {/* Customer selector */}
          <div className="form-group">
            <label className="form-label">Customer</label>

            {customerType === 'regular' ? (
              /* ── Regular: grouped dropdown of all regular customers ── */
              <>
                <select
                  className="form-select"
                  value={customerId}
                  onChange={(e) => { setCustomerId(e.target.value); setAdvanceUsed(0) }}
                >
                  <option value="">-- Select regular customer --</option>
                  {activeRegular.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </option>
                  ))}
                </select>
              </>
            ) : (
              /* ── Random: pick existing walk-in OR create new ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="radio-group">
                  <label className={`radio-option ${randomMode === 'existing' ? 'selected' : ''}`}>
                    <input type="radio" checked={randomMode === 'existing'} onChange={() => { setRandomMode('existing'); setCustomerName(''); setCustomerPhone(''); setCustomerEmail('') }} />
                    Existing Walk-in
                  </label>
                  <label className={`radio-option ${randomMode === 'new' ? 'selected' : ''}`}>
                    <input type="radio" checked={randomMode === 'new'} onChange={() => { setRandomMode('new'); setRandomCustomerId('') }} />
                    <UserPlus size={13} /> New Customer
                  </label>
                </div>

                {randomMode === 'existing' ? (
                  <select
                    className="form-select"
                    value={randomCustomerId}
                    onChange={(e) => { setRandomCustomerId(e.target.value); setAdvanceUsed(0) }}
                  >
                    <option value="">-- Select walk-in customer --</option>
                    {activeRandom.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="Customer name *"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                    <input
                      className="form-input"
                      type="tel"
                      placeholder="Phone number (optional)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                    <input
                      className="form-input"
                      type="email"
                      placeholder="Email (optional)"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                      Will be saved as a new walk-in customer with a unique ID.
                    </p>
                  </>
                )}
              </div>
            )}

            {selectedCustomer && settings.loyaltyEnabled !== false && (
              <div style={{ marginTop: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Loyalty Balance: <strong>{selectedCustomer.loyaltyPoints || 0}</strong> points
                {selectedCustomer.loyaltyPoints > 0 && (
                  <> (value: <strong>₹{((selectedCustomer.loyaltyPoints || 0) * (settings.loyaltyRedeemRatioRupees || 5) / (settings.loyaltyRedeemRatioPoints || 150)).toFixed(2)}</strong>)</>
                )}
              </div>
            )}

          </div>

          <div className="form-group">
            <label className="form-label">Bill Date</label>
            <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        {/* Quick Presets Panel */}
        <div className="card" style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-elevated)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Quick Presets / Job Templates</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {PRESETS.map((preset, idx) => {
              const existing = itemRows.find((r) => {
                if (preset.isCustom) {
                  return r.isCustom && r.itemName === preset.itemName
                } else {
                  return !r.isCustom && r.itemId === preset.itemId && r.printType === preset.printType && r.sides === preset.sides
                }
              })
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => addPreset(preset)}
                  style={{
                    fontSize: '0.8rem',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: existing ? '1px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.3)',
                    background: existing ? 'rgba(245, 158, 11, 0.18)' : 'rgba(245, 158, 11, 0.06)',
                    color: existing ? '#f59e0b' : '#a1a1aa',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {preset.label}{existing ? ` ×${existing.qty}` : ''}
                </button>
              )
            })}
          </div>
        </div>

        {/* Items table */}
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
                  <th>GST Rate</th>
                  <th>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {itemRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.isCustom ? (
                        <input
                          className="form-input"
                          type="text"
                          placeholder="Item name"
                          value={row.itemName}
                          onChange={(e) => updateRow(row.id, { itemName: e.target.value })}
                        />
                      ) : (
                        <select
                          className="form-select"
                          value={row.itemId}
                          onChange={(e) => {
                            const itemId = e.target.value
                            const selected = inventory.find((item) => item.id === itemId)
                            handleComboChange(row.id, {
                              itemId,
                              itemName: selected?.name || row.itemName,
                              unitPrice: getItemBasePrice(itemId, row.printType, row.sides),
                            })
                          }}
                        >
                          {inventory.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <select
                        className="form-select"
                        value={row.printType}
                        onChange={(e) => {
                          const printType = e.target.value
                          if (row.isCustom) {
                            updateRow(row.id, { printType })
                          } else {
                            handleComboChange(row.id, {
                              printType,
                              unitPrice: getItemBasePrice(row.itemId, printType, row.sides),
                            })
                          }
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
                        onChange={(e) => {
                          const sides = e.target.value
                          if (row.isCustom) {
                            updateRow(row.id, { sides })
                          } else {
                            handleComboChange(row.id, {
                              sides,
                              unitPrice: getItemBasePrice(row.itemId, row.printType, sides),
                            })
                          }
                        }}
                      >
                        <option value="single">Single</option>
                        <option value="double">Double</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="form-input"
                        type="number"
                        min="1"
                        value={row.qty}
                        onChange={(e) => updateRow(row.id, { qty: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.unitPrice}
                        onChange={(e) => updateRow(row.id, { unitPrice: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        className="form-select"
                        value={row.gstRate || 0}
                        onChange={(e) => updateRow(row.id, { gstRate: Number(e.target.value) })}
                      >
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                      </select>
                    </td>
                    <td>₹{Number(row.amount).toFixed(2)}</td>
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
          {/* Add item buttons — below the table */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={addRow}>
              <Plus size={14} /> Add Item
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addCustomRow}>
              <Plus size={14} /> Custom Item
            </button>
          </div>
        </div>

        {/* Discount & Notes */}
        <div className="grid-2" style={{ marginTop: '24px', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Discount</label>
            <div className="form-inline">
              <select className="form-select" value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                <option value="flat">Flat (₹)</option>
                <option value="percent">Percent (%)</option>
              </select>
              <input className="form-input" type="number" min="0" step="any" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" />
            </div>

            <div style={{ marginTop: '12px' }}>
              <label className="form-label">Promo Code</label>
              <div className="form-inline">
                <input
                  className="form-input"
                  type="text"
                  placeholder="Enter Code (e.g. STUDENT10)"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value)}
                />
                <button type="button" className="btn btn-secondary" onClick={handleApplyPromo}>Apply</button>
              {promoError && <p style={{ color: 'var(--error)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>{promoError}</p>}
              {appliedPromo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>
                  <Tag size={12} /> Applied: {appliedPromo.code} ({appliedPromo.type === 'percent' ? `${appliedPromo.value}% off` : `₹${appliedPromo.value} off`})
                  <button type="button" className="btn btn-link btn-sm" style={{ color: 'var(--error)', padding: 0 }} onClick={() => { setAppliedPromo(null); setDiscountValue(0); }}>Remove</button>
                </div>
              )}
            </div>
            </div>

            {settings.loyaltyEnabled !== false && settings.loyaltyRedeemEnabled !== false && selectedCustomer && (
              <div style={{ marginTop: '16px' }}>
                <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px' }}>
                  <input
                    type="checkbox"
                    checked={shouldRedeemPoints}
                    onChange={(e) => {
                      setShouldRedeemPoints(e.target.checked)
                      if (!e.target.checked) {
                        setLoyaltyPointsRedeemedInput('')
                      }
                    }}
                  />
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>Redeem Loyalty Points for this purchase</span>
                </label>

                {shouldRedeemPoints && (
                  <>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        className="form-select"
                        value={loyaltyPointsRedeemedInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          const maxPts = (selectedCustomer.loyaltyPoints || 0) + (isEditing ? (bills.find(b => b.id === editingBillId)?.loyaltyPointsRedeemed || 0) : 0);
                          const points = Number(val || 0);
                          if (points > maxPts) {
                            showAlert(`Cannot redeem more than available balance of ${maxPts} points.`, 'error');
                            return;
                          }
                          // Check if discount exceeds total
                          const selectedOpt = (settings.loyaltyRedeemOptions || [
                            { points: 100, rupees: 2.5 },
                            { points: 120, rupees: 3 },
                            { points: 150, rupees: 5 },
                          ]).find(o => Number(o.points) === points);
                          const discount = selectedOpt ? Number(selectedOpt.rupees) : 0;
                          const currentBillTotalWithoutLoyalty = Math.max(subtotal + totalGst - discountAmount, 0);
                          if (discount > currentBillTotalWithoutLoyalty) {
                            showAlert(`Loyalty discount (₹${discount.toFixed(2)}) cannot exceed the bill total (₹${currentBillTotalWithoutLoyalty.toFixed(2)}).`, 'error');
                            return;
                          }
                          setLoyaltyPointsRedeemedInput(val);
                        }}
                      >
                        <option value="">-- Select Redemption Option --</option>
                        {(settings.loyaltyRedeemOptions || [
                          { points: 100, rupees: 2.5 },
                          { points: 120, rupees: 3 },
                          { points: 150, rupees: 5 },
                        ]).map((opt) => {
                          const maxPts = (selectedCustomer.loyaltyPoints || 0) + (isEditing ? (bills.find(b => b.id === editingBillId)?.loyaltyPointsRedeemed || 0) : 0);
                          const isDisabled = opt.points > maxPts;
                          return (
                            <option key={opt.points} value={opt.points} disabled={isDisabled}>
                              {opt.points} Points = ₹{opt.rupees} Discount {isDisabled ? '(Insufficient Points)' : ''}
                            </option>
                          );
                        })}
                      </select>
                      {loyaltyPointsRedeemedInput && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--success)', whiteSpace: 'nowrap' }}>
                          -₹{( ( (settings.loyaltyRedeemOptions || [
                            { points: 100, rupees: 2.5 },
                            { points: 120, rupees: 3 },
                            { points: 150, rupees: 5 },
                          ]).find(o => Number(o.points) === Number(loyaltyPointsRedeemedInput))?.rupees || 0 )).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Available: {(selectedCustomer.loyaltyPoints || 0) + (isEditing ? (bills.find(b => b.id === editingBillId)?.loyaltyPointsRedeemed || 0) : 0)} points
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Job notes or print remarks" />
          </div>
        </div>

        {/* Payment & Summary */}
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
              <input className="form-input" type="number" min="0" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">UPI Amount</label>
              <input className="form-input" type="number" min="0" value={upiAmount} onChange={(e) => setUpiAmount(e.target.value)} />
            </div>
            {(() => {
              const totalPaidNow = Number(cashAmount || 0) + Number(upiAmount || 0)
              const changeDue = totalPaidNow - total
              return changeDue > 0 ? (
                <div style={{
                  margin: '12px 0 16px 0', padding: '14px',
                  background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: 'var(--radius-md)', fontSize: '0.85rem'
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--warning)', marginBottom: '8px' }}>
                    Excess Payment / Change: ₹{changeDue.toFixed(2)}
                  </div>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>Handle Change Options:</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                      <input
                        type="radio"
                        name="changeHandling"
                        value="advance"
                        checked={changeHandling === 'advance'}
                        onChange={() => setChangeHandling('advance')}
                      />
                      Add to Customer's Advance Balance
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                      <input
                        type="radio"
                        name="changeHandling"
                        value="upi_refund"
                        checked={changeHandling === 'upi_refund'}
                        onChange={() => setChangeHandling('upi_refund')}
                      />
                      Return change immediately via UPI (sent back)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                      <input
                        type="radio"
                        name="changeHandling"
                        value="cash_refund"
                        checked={changeHandling === 'cash_refund'}
                        onChange={() => setChangeHandling('cash_refund')}
                      />
                      Return change immediately via Cash
                    </label>
                  </div>
                </div>
              ) : null
            })()}
            <div className="form-group">
              <label className="form-label">UPI Checkout</label>
              <div className="form-inline" style={{ gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={handleGenerateUpiLink}>
                  <Link2 size={14} /> Generate QR
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!upiCheckoutAmount || !business?.upiId}
                  onClick={() => copyUpiLink(getUpiLink(upiCheckoutAmount))}
                >
                  <Copy size={14} /> Copy Link
                </button>
              </div>
              {business?.upiId ? (
                <>
                  <p className="text-muted" style={{ marginTop: '6px', marginBottom: '8px' }}>UPI ID: {business.upiId} · Amount: ₹{upiCheckoutAmount.toFixed(2)}</p>
                  {upiCheckoutAmount > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(getUpiLink(upiCheckoutAmount))}`}
                        alt="UPI QR Code"
                        style={{ borderRadius: '8px', border: '3px solid var(--accent)', padding: '4px', background: '#fff' }}
                        width={140} height={140}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Scan with any UPI app to pay ₹{upiCheckoutAmount.toFixed(2)}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted" style={{ marginTop: '6px' }}>Set your UPI ID in Settings to enable QR codes.</p>
              )}
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Advance / Credit Balance</label>
              <div className="stat-card-value" style={{ color: customerAdvance > 0 ? 'var(--info)' : 'var(--text-muted)' }}>₹{customerAdvance.toFixed(2)}</div>
            </div>

            {/* Advance balance info for selected customer */}
            {selectedCustomer && Number(selectedCustomer.advanceBalance || 0) > 0 && (
              <div style={{
                marginTop: '16px', padding: '12px 14px',
                background: 'var(--info-bg)', border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: 'var(--radius-md)', fontSize: '0.85rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--info)' }}>
                  <Wallet size={14} /> Advance Balance: <strong>₹{Number(selectedCustomer.advanceBalance).toFixed(2)}</strong>
                </div>
                <label className="form-label" style={{ marginBottom: '4px' }}>Apply Advance (₹)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max={Math.min(Number(selectedCustomer.advanceBalance), total)}
                  step="0.01"
                  value={advanceUsed}
                  onChange={(e) => setAdvanceUsed(Math.min(Number(e.target.value), Number(selectedCustomer.advanceBalance), total))}
                  placeholder="0.00"
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdvanceUsed(Math.min(Number(selectedCustomer.advanceBalance), total))}>
                    Use Full Advance
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdvanceUsed(0)}>
                    Clear
                  </button>
                </div>
              </div>
            )}
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
            {totalGst > 0 && (
              <div className="form-row" style={{ marginTop: '8px' }}>
                <div className="form-group">
                  <label className="form-label">CGST ({(totalGst / 2).toFixed(2)})</label>
                  <div className="stat-card-value" style={{ fontSize: '1.1rem' }}>₹{(totalGst / 2).toFixed(2)}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">SGST ({(totalGst / 2).toFixed(2)})</label>
                  <div className="stat-card-value" style={{ fontSize: '1.1rem' }}>₹{(totalGst / 2).toFixed(2)}</div>
                </div>
              </div>
            )}
            <div className="form-group" style={{ marginTop: '12px', marginBottom: '12px' }}>
              <label className="form-label">Override GST Amount</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                placeholder={`Auto: ₹${autoGst.toFixed(2)}`}
                value={customGst}
                onChange={(e) => setCustomGst(e.target.value)}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Total</label>
                <div className="stat-card-value">₹{total.toFixed(2)}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Cash + UPI Paid</label>
                <div className="stat-card-value">₹{amountPaid.toFixed(2)}</div>
              </div>
            </div>
            {appliedAdvance > 0 && (
              <div className="form-group">
                <label className="form-label">Advance Used</label>
                <div className="stat-card-value" style={{ color: 'var(--info)' }}>₹{appliedAdvance.toFixed(2)}</div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Balance Remaining</label>
              <div className="stat-card-value" style={{ color: netBalance > 0 ? 'var(--error)' : 'var(--success)' }}>₹{netBalance.toFixed(2)}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <span className={`badge badge-${finalStatus === 'paid' ? 'paid' : finalStatus === 'partial' ? 'partial' : 'unpaid'}`}>
                {finalStatus}
              </span>
            </div>
            {excessPaid > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                marginTop: '12px',
                background: 'var(--info-bg)',
                border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--info)',
                fontSize: '0.875rem',
                fontWeight: 600
              }}>
                <Wallet size={16} /> ₹{excessPaid.toFixed(2)} excess will be added to customer's Advance Credit
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-primary">
            <FilePlus size={16} /> {isEditing ? 'Save Changes' : 'Generate Bill'}
          </button>
          {isEditing && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setIsEditing(false); setEditingBillId(null); resetForm() }}
            >
              <X size={16} /> Cancel
            </button>
          )}
        </div>
        </form>
      )}

      {/* Recent Bills Table */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="bill-view-header">
          <h2>Recent Billing Activity</h2>
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
              {bills.filter((b) => !b.deleted).map((bill) => (
                <tr key={bill.id}>
                  <td>
                    <div style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)', fontSize: '0.82rem' }}>{bill.id}</div>
                    <span className={`badge ${bill.customerType === 'regular' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '0.6rem', marginTop: '2px' }}>
                      {bill.customerType === 'regular' ? 'Regular' : 'Walk-in'}
                    </span>
                  </td>
                  <td>{bill.customerName}</td>
                  <td>₹{bill.total.toFixed(2)}</td>
                  <td>₹{bill.amountPaid.toFixed(2)}</td>
                  <td style={{ color: bill.balance > 0 ? 'var(--warning)' : 'inherit' }}>₹{bill.balance.toFixed(2)}</td>
                  <td>
                    <span className={`badge badge-${bill.status === 'paid' ? 'paid' : bill.status === 'partial' ? 'partial' : 'unpaid'}`}>
                      {bill.status}
                    </span>
                  </td>
                  <td className="table-actions">
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => openBillModal(bill)}>
                      <ClipboardList size={14} /> View
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleEditBill(bill)}
                      title="Edit Bill"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => printPOSReceipt(bill)}
                      title="POS Receipt"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Printer size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => shareOnWhatsApp(bill)}
                      title="WhatsApp Receipt"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#25D366' }}
                    >
                      <Share2 size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => {
                        if (window.confirm(`Delete bill ${bill.id}? It will be moved to Deleted Bills.`)) {
                          deleteBill(bill.id)
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill Detail Modal */}
      {isModalOpen && liveBill && (
        <div className="modal-overlay" onClick={closeBillModal}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px' }}>
            <div className="modal-header">
              <div>
                <h3>Bill Details</h3>
                <p className="text-muted">{liveBill.id} — {liveBill.customerName}</p>
              </div>
              <button className="modal-close btn-icon" type="button" onClick={closeBillModal}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" ref={billRef}>
              {settings.loyaltyEnabled !== false && liveBill.customerType === 'regular' && (
                <div style={{
                  padding: '10px 14px',
                  marginBottom: '16px',
                  background: 'rgba(59, 130, 246, 0.08)',
                  borderLeft: `4px solid ${settings.primaryColor || 'var(--accent)'}`,
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}>
                  <span>Loyalty Points Added: +{liveBill.loyaltyPointsEarned || 0}</span>
                  <span>New Points Balance: {liveBill.customerTotalLoyaltyPoints || 0} pts</span>
                </div>
              )}
              {/* Bill header */}
              <div className="bill-view-header" style={{ marginBottom: '16px' }}>
                <div>
                  <div className="bill-view-id" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {liveBill.customerType === 'regular' ? liveBill.customerId : 'Random Customer'}
                  </div>
                  <h4>{liveBill.customerName}</h4>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.875rem' }}>
                  <p>Date: {liveBill.date}</p>
                  <p>Due: {liveBill.dueDate}</p>
                  <p>Status: <span className={`badge badge-${liveBill.status === 'paid' ? 'paid' : liveBill.status === 'partial' ? 'partial' : 'unpaid'}`}>{liveBill.status}</span></p>
                </div>
              </div>

              {/* Items */}
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
                    {liveBill.items.map((item, idx) => (
                      <tr key={`${liveBill.id}-${idx}`}>
                        <td>{item.itemName || item.name}</td>
                        <td>{item.printType === 'color' ? 'Color' : 'B/W'}</td>
                        <td>{item.sides === 'single' ? 'Single' : 'Double'}</td>
                        <td>{item.qty}</td>
                        <td>₹{Number(item.unitPrice).toFixed(2)}</td>
                        <td>₹{Number(item.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary + Payments */}
              <div className="grid-2" style={{ gap: '20px', marginTop: '20px' }}>
                <div className="card" style={{ padding: '20px' }}>
                  <h4>Summary</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Subtotal</label>
                      <div className="stat-card-value">₹{liveBill.subtotal.toFixed(2)}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Discount ({liveBill.discountType === 'percent' ? `${liveBill.discountValue}%` : 'flat'})</label>
                      <div className="stat-card-value">₹{Number(liveBill.discountAmount ?? (liveBill.discountType === 'percent' ? (liveBill.subtotal * liveBill.discountValue / 100) : liveBill.discountValue)).toFixed(2)}</div>
                    </div>
                  </div>
                  {liveBill.gstAmount > 0 && (
                    <div className="form-row" style={{ marginTop: '8px' }}>
                      <div className="form-group">
                        <label className="form-label">CGST ({(liveBill.gstAmount / 2).toFixed(2)})</label>
                        <div className="stat-card-value" style={{ fontSize: '1.1rem' }}>₹{(liveBill.gstAmount / 2).toFixed(2)}</div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">SGST ({(liveBill.gstAmount / 2).toFixed(2)})</label>
                        <div className="stat-card-value" style={{ fontSize: '1.1rem' }}>₹{(liveBill.gstAmount / 2).toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Total</label>
                      <div className="stat-card-value">₹{liveBill.total.toFixed(2)}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Amount Paid</label>
                      <div className="stat-card-value">₹{liveBill.amountPaid.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Balance</label>
                    <div className="stat-card-value" style={{ color: liveBill.balance > 0 ? 'var(--error)' : 'var(--success)' }}>
                      ₹{liveBill.balance.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                  <h4>Payment Methods</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Cash</label>
                      <div className="stat-card-value">₹{(liveBill.paymentMethod?.cash || 0).toFixed(2)}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">UPI</label>
                      <div className="stat-card-value">₹{(liveBill.paymentMethod?.upi || 0).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Credit Used</label>
                    <div className="stat-card-value">₹{(liveBill.creditUsed || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Payment History */}
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
                          <td>₹{Number(payment.cashAmount || 0).toFixed(2)}</td>
                          <td>₹{Number(payment.upiAmount || 0).toFixed(2)}</td>
                          <td>₹{Number(payment.totalPaid || 0).toFixed(2)}</td>
                          <td>{payment.paymentType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-muted">No payment history yet.</p>
                )}
              </div>

              {/* Apply Post-bill Discount */}
              <div className="card" style={{ marginTop: '20px', padding: '20px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Tag size={16} /> Apply Discount
                </h4>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
                  Update discount on this bill after creation. Total, balance, and status will be recalculated.
                </p>
                {discountApplyMsg && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 14px', marginBottom: '12px',
                    background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
                    borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
                  }}>
                    <CheckCircle size={16} /> {discountApplyMsg}
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Discount Type</label>
                    <select
                      className="form-select"
                      value={discountModalType}
                      onChange={(e) => setDiscountModalType(e.target.value)}
                    >
                      <option value="flat">Flat (₹)</option>
                      <option value="percent">Percent (%)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Discount Value</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountModalValue}
                      onChange={(e) => setDiscountModalValue(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Subtotal: ₹{liveBill.subtotal.toFixed(2)} → New Total: ₹{Math.max(
                    liveBill.subtotal - (discountModalType === 'percent'
                      ? (liveBill.subtotal * Number(discountModalValue || 0)) / 100
                      : Number(discountModalValue || 0)), 0
                  ).toFixed(2)}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleApplyPostDiscount}
                >
                  <Percent size={16} /> Apply Discount
                </button>
              </div>

              {/* Follow-up Payment */}
              <div className="card" style={{ marginTop: '20px', padding: '20px' }}>
                <h4>Record Follow-up Payment</h4>

                {/* Balance summary */}
                <div style={{
                  display: 'flex', gap: '20px', flexWrap: 'wrap',
                  padding: '12px 16px', marginBottom: '16px',
                  background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)'
                }}>
                  <div>
                    <div className="form-label" style={{ marginBottom: '2px' }}>Current Balance</div>
                    <div style={{ fontWeight: 700, color: liveBill.balance > 0 ? 'var(--error)' : 'var(--success)', fontSize: '1.1rem' }}>
                      ₹{liveBill.balance.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="form-label" style={{ marginBottom: '2px' }}>Paying Now</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                      ₹{(Number(followUpCash || 0) + Number(followUpUpi || 0)).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="form-label" style={{ marginBottom: '2px' }}>Balance After</div>
                    <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1.1rem' }}>
                      ₹{Math.max(liveBill.balance - (Number(followUpCash || 0) + Number(followUpUpi || 0)), 0).toFixed(2)}
                    </div>
                  </div>
                  {(() => {
                    const paying = Number(followUpCash || 0) + Number(followUpUpi || 0)
                    const excess = Math.max(paying - liveBill.balance, 0)
                    return excess > 0 ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--info-bg)', border: '1px solid rgba(59,130,246,0.2)',
                        color: 'var(--info)', fontWeight: 600, fontSize: '0.82rem'
                      }}>
                        <Wallet size={13} /> ₹{excess.toFixed(2)} → Advance Credit
                      </div>
                    ) : null
                  })()}
                </div>

                {paymentSuccess && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 14px', marginBottom: '12px',
                    background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
                    borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
                  }}>
                    <CheckCircle size={16} /> Payment recorded successfully!
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Follow-up Cash (₹)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={followUpCash}
                      onChange={(e) => setFollowUpCash(e.target.value)}
                      disabled={liveBill.balance <= 0}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Follow-up UPI (₹)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={followUpUpi}
                      onChange={(e) => setFollowUpUpi(e.target.value)}
                      disabled={liveBill.balance <= 0}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleRecordFollowUpPayment}
                  disabled={
                    liveBill.balance <= 0 ||
                    Number(followUpCash || 0) + Number(followUpUpi || 0) <= 0
                  }
                >
                  <CheckCircle size={16} />
                  {liveBill.balance <= 0 ? 'Balance is Settled' : 'Record Payment'}
                </button>

                {liveBill.balance <= 0 && (
                  <p className="text-muted" style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                    This bill is fully paid.
                  </p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={downloadBillPDF}>
                <FileText size={16} /> Download PDF
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => printPOSReceipt(liveBill)}>
                <Printer size={16} /> Print POS
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => shareOnWhatsApp(liveBill)} style={{ color: '#25D366' }}>
                <Share2 size={16} /> WhatsApp Share
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { handleEditBill(liveBill); closeBillModal() }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Pencil size={16} /> Edit Bill
              </button>
              {/* UPI QR in modal */}
              {business?.upiId && liveBill.balance > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(getUpiLink(liveBill.balance))}`}
                    alt="Pay QR"
                    style={{ borderRadius: '6px', border: '2px solid var(--accent)', background: '#fff', padding: '2px' }}
                    width={80} height={80}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--accent)' }}>Scan to Pay</div>
                    <div>₹{liveBill.balance.toFixed(2)} pending</div>
                  </div>
                </div>
              )}
              <button type="button" className="btn btn-ghost" onClick={closeBillModal}>
                <X size={16} /> Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Decimal Rounding Modal ─────────────────────────────────────── */}
      {showRoundingModal && pendingBillPayload && (
        <div className="modal-overlay" onClick={() => { setShowRoundingModal(false); setPendingBillPayload(null) }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>Round Bill Total?</h3>
              <button className="modal-close btn-icon" type="button"
                onClick={() => { setShowRoundingModal(false); setPendingBillPayload(null) }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                The bill total is <strong style={{ color: 'var(--accent)' }}>
                  ₹{pendingBillPayload.total.toFixed(2)}
                </strong>. Would you like to round it?
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flexDirection: 'column', height: '72px', gap: '4px' }}
                  onClick={() => handleRoundingChoice(Math.floor(pendingBillPayload.total))}
                >
                  <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    ₹{Math.floor(pendingBillPayload.total)}
                  </span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Round Down</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flexDirection: 'column', height: '72px', gap: '4px' }}
                  onClick={() => handleRoundingChoice(Math.ceil(pendingBillPayload.total))}
                >
                  <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    ₹{Math.ceil(pendingBillPayload.total)}
                  </span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Round Up</span>
                </button>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', fontSize: '0.82rem' }}
                onClick={() => handleRoundingChoice(pendingBillPayload.total)}
              >
                Keep exact amount ₹{pendingBillPayload.total.toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Refund Modal ─────────────────────────────────────────────── */}
      {showRefundModal && refundInfo && (
        <div className="modal-overlay" onClick={() => { setShowRefundModal(false); setRefundInfo(null); setCustomerUpiId('') }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3>Refund Options</h3>
              <button className="modal-close btn-icon" type="button"
                onClick={() => { setShowRefundModal(false); setRefundInfo(null); setCustomerUpiId('') }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ color: 'var(--text-secondary)' }}>
                The new bill total is lower than what was already paid. A total refund of <strong style={{ color: 'var(--warning)' }}>₹{refundInfo.refundDue.toFixed(2)}</strong> is due.
              </p>

              {refundInfo.advanceRefund > 0 && (
                <div style={{ padding: '10px 14px', background: 'var(--info-bg)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--info)', fontWeight: 600 }}>Automatic Advance Return:</span>
                  <div style={{ marginTop: '4px' }}>₹{refundInfo.advanceRefund.toFixed(2)} will be credited back to customer's Advance balance (reversing advance used).</div>
                </div>
              )}

              {refundInfo.directRefund > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Handle direct refund of ₹{refundInfo.directRefund.toFixed(2)}:</label>
                    <div className="radio-group" style={{ marginTop: '6px' }}>
                      <label className={`radio-option ${refundChoice === 'direct' ? 'selected' : ''}`}>
                        <input type="radio" name="refundChoice" value="direct" checked={refundChoice === 'direct'} onChange={() => setRefundChoice('direct')} />
                        Direct Refund (Cash/UPI)
                      </label>
                      <label className={`radio-option ${refundChoice === 'advance' ? 'selected' : ''}`}>
                        <input type="radio" name="refundChoice" value="advance" checked={refundChoice === 'advance'} onChange={() => setRefundChoice('advance')} />
                        Credit to Advance Balance
                      </label>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Refund Method</label>
                    <div className="radio-group" style={{ marginTop: '6px' }}>
                      <label className={`radio-option ${refundMethod === 'cash' ? 'selected' : ''}`}>
                        <input type="radio" name="refundMethod" value="cash" checked={refundMethod === 'cash'} onChange={() => setRefundMethod('cash')} />
                        Cash
                      </label>
                      <label className={`radio-option ${refundMethod === 'upi' ? 'selected' : ''}`}>
                        <input type="radio" name="refundMethod" value="upi" checked={refundMethod === 'upi'} onChange={() => setRefundMethod('upi')} />
                        UPI
                      </label>
                    </div>
                  </div>

                  {refundChoice === 'direct' && refundMethod === 'upi' && (
                    <div className="form-group">
                      <label className="form-label">Customer UPI ID / Phone for Refund</label>
                      <input
                        className="form-input"
                        type="text"
                        placeholder="e.g. 9876543210@upi or customer UPI ID"
                        value={customerUpiId}
                        onChange={(e) => {
                          setCustomerUpiId(e.target.value)
                          setRefundQrGenerated(false)
                        }}
                      />
                      <div className="form-group" style={{ marginTop: '12px' }}>
                        <label className="form-label">UPI Refund Checkout</label>
                        <div className="form-inline" style={{ gap: '12px', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={!customerUpiId}
                            onClick={() => setRefundQrGenerated(true)}
                            style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Link2 size={14} /> Generate QR
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={!customerUpiId || !refundQrGenerated}
                            onClick={() => copyUpiLink(`upi://pay?pa=${customerUpiId}&pn=${encodeURIComponent(editingBill?.customerName || 'Customer')}&am=${refundInfo.directRefund.toFixed(2)}&cu=INR&tn=Refund`)}
                            style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Copy size={14} /> Copy Link
                          </button>
                        </div>
                        {customerUpiId ? (
                          <>
                            {refundQrGenerated && (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px', marginTop: '10px' }}>
                                <img
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`upi://pay?pa=${customerUpiId}&pn=${encodeURIComponent(editingBill?.customerName || 'Customer')}&am=${refundInfo.directRefund.toFixed(2)}&cu=INR&tn=Refund`)}`}
                                  alt="Refund QR Code"
                                  style={{ borderRadius: '8px', border: '3px solid var(--accent)', padding: '4px', background: '#fff' }}
                                  width={100} height={100}
                                />
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Scan to pay customer ₹{refundInfo.directRefund.toFixed(2)}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-muted" style={{ marginTop: '6px', fontSize: '0.78rem' }}>Enter Customer UPI ID to enable QR code.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowRefundModal(false); setRefundInfo(null); setCustomerUpiId('') }}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={handleConfirmRefund}>
                  Confirm Refund & Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Billing

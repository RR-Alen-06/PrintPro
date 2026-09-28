import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CreditService } from '../creditService'
import { ReminderService } from '../reminderService'

describe('Workflow 5: Customer Credit Limit Enforcement & Automated WhatsApp Due Reminders One-to-One Trace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs complete one-to-one workflow: Credit Limit Validation -> Violation Interception -> Partial Cash Downpayment -> WhatsApp Overdue Reminder with UPI Link', () => {
    // =========================================================================
    // STAGE 1: CUSTOMER CREDIT PROFILE SETUP
    // =========================================================================
    const customer = {
      id: 'cust-vikas-01',
      customer_code: 'CUS-000450',
      name: 'Vikas Graphics & Signage',
      phone: '9888877777',
      credit_limit: 5000.0, // Approved credit limit ceiling
      current_outstanding: 3800.0, // Existing unpaid ledger balance
    }

    // =========================================================================
    // STAGE 2: TRANSACTION 1 - WITHIN LIMIT ORDER
    // =========================================================================
    // Customer requests ₹1,000 printing job on credit
    const order1Amount = 1000.0
    const check1 = CreditService.checkCreditLimit(
      customer.current_outstanding,
      customer.credit_limit,
      order1Amount
    )

    expect(check1.isAllowed).toBe(true)
    expect(check1.newBalance).toBe(4800.0)
    expect(check1.exceededBy).toBe(0)

    // Apply transaction 1
    customer.current_outstanding = check1.newBalance
    expect(customer.current_outstanding).toBe(4800.0)

    // =========================================================================
    // STAGE 3: TRANSACTION 2 - CREDIT LIMIT VIOLATION INTERCEPTION
    // =========================================================================
    // Customer requests another ₹500 job completely on credit
    const order2Amount = 500.0
    const check2 = CreditService.checkCreditLimit(
      customer.current_outstanding,
      customer.credit_limit,
      order2Amount
    )

    // System must intercept and reject pure credit sale
    expect(check2.isAllowed).toBe(false)
    expect(check2.newBalance).toBe(5300.0)
    expect(check2.exceededBy).toBe(300.0)

    // =========================================================================
    // STAGE 4: RESOLUTION VIA MANDATORY CASH DOWNPAYMENT
    // =========================================================================
    // Cashier requires customer to pay at least the exceeded amount (₹300) in Cash
    const requiredDownpayment = check2.exceededBy
    expect(requiredDownpayment).toBe(300.0)

    const customerCashPayment = 300.0
    const netCreditRequested = order2Amount - customerCashPayment // ₹200 added to credit

    // Re-evaluate credit check with adjusted net credit
    const check2Resolved = CreditService.checkCreditLimit(
      customer.current_outstanding,
      customer.credit_limit,
      netCreditRequested
    )

    expect(check2Resolved.isAllowed).toBe(true)
    expect(check2Resolved.newBalance).toBe(5000.0) // Exactly matches limit
    expect(check2Resolved.exceededBy).toBe(0)

    // Apply transaction 2
    customer.current_outstanding = check2Resolved.newBalance
    expect(customer.current_outstanding).toBe(5000.0)

    // =========================================================================
    // STAGE 5: AUTOMATED WHATSAPP OVERDUE LEDGER REMINDER GENERATION
    // =========================================================================
    const businessProfile = {
      shopName: 'PrintPro High-Tech Hub',
      phone: '919876543210',
      upiId: 'printpro@icici',
    }

    const settings = {
      includeUpiInWhatsApp: true,
      whatsappGreeting: 'Dear *{customer_name}*,',
      whatsappFooter: 'Kindly clear the pending balance at your earliest convenience.\n— *{shop_name}*',
    }

    const reminderMessage = ReminderService.buildLedgerReminderMessage(
      customer,
      customer.current_outstanding,
      businessProfile,
      settings
    )

    // Verify reminder content
    expect(reminderMessage).toContain('🔔 *PAYMENT REMINDER — PRINTPRO HIGH-TECH HUB*')
    expect(reminderMessage).toContain('Vikas Graphics & Signage')
    expect(reminderMessage).toContain('₹5000.00')

    // Verify 1-Click UPI Payment deep link embedded in message
    expect(reminderMessage).toContain('upi://pay?pa=printpro%40icici&pn=PrintPro%20High-Tech%20Hub&am=5000.00&cu=INR')

    // Verify direct WhatsApp send URL generation and country code sanitization (919888877777)
    const whatsAppUrl = ReminderService.getWhatsAppUrl(customer.phone, reminderMessage)
    expect(whatsAppUrl).toContain('https://api.whatsapp.com/send?phone=919888877777')
    expect(whatsAppUrl).toContain(encodeURIComponent('₹5000.00'))
  })
})

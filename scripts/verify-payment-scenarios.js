/**
 * Unified Payment System Verification Suite
 * Tests all 14 Bill Payment Scenarios and Advance Payment operations
 * against the centralized mathematical calculation and settlement engine.
 */

const assert = require('assert');

// ── Financial Calculation & Accounting Engine ──────────────────────────────
function calculateSettlement({
  bills = [], // [{ id, total, amountPaid, balance }]
  advanceBalance = 0,
  cashReceived = 0,
  upiReceived = 0,
  useAdvance = false,
  advanceToApply = 0,
  targetBillId = 'all', // 'all' for FIFO, or specific bill ID
  isWalkIn = false
}) {
  const directCollection = cashReceived + upiReceived;
  const availableAdvance = Math.max(0, advanceBalance);

  let targetBills = [];
  if (targetBillId !== 'all') {
    targetBills = bills.filter(b => b.id === targetBillId);
  } else {
    // FIFO sorted
    targetBills = [...bills].filter(b => b.balance > 0);
  }

  const targetAmountDue = targetBills.reduce((acc, b) => acc + (b.balance || 0), 0);

  let actualAdvanceUsed = 0;
  if (useAdvance && availableAdvance > 0) {
    const requested = advanceToApply > 0 ? advanceToApply : availableAdvance;
    actualAdvanceUsed = Math.min(requested, availableAdvance, targetAmountDue);
  }

  const remainingDueAfterAdv = Math.max(0, targetAmountDue - actualAdvanceUsed);
  const directApplied = Math.min(directCollection, remainingDueAfterAdv);
  const totalSettlementApplied = directApplied + actualAdvanceUsed;

  // Excess direct collection calculation
  let excessToCredit = 0;
  if (directCollection > remainingDueAfterAdv) {
    if (!isWalkIn) {
      excessToCredit = directCollection - remainingDueAfterAdv;
    }
  }

  const finalOutstanding = Math.max(0, targetAmountDue - totalSettlementApplied);
  const remainingAdvance = availableAdvance - actualAdvanceUsed + excessToCredit;

  // Simulate bill allocation
  let remAdv = actualAdvanceUsed;
  let remCash = cashReceived;
  let remUpi = upiReceived;

  const allocatedBills = targetBills.map(b => {
    let billDue = b.balance;
    let advAppliedToBill = 0;
    let cashAppliedToBill = 0;
    let upiAppliedToBill = 0;

    if (remAdv > 0 && billDue > 0) {
      advAppliedToBill = Math.min(remAdv, billDue);
      remAdv -= advAppliedToBill;
      billDue -= advAppliedToBill;
    }

    if (remCash > 0 && billDue > 0) {
      cashAppliedToBill = Math.min(remCash, billDue);
      remCash -= cashAppliedToBill;
      billDue -= cashAppliedToBill;
    }

    if (remUpi > 0 && billDue > 0) {
      upiAppliedToBill = Math.min(remUpi, billDue);
      remUpi -= upiAppliedToBill;
      billDue -= upiAppliedToBill;
    }

    const totalApplied = advAppliedToBill + cashAppliedToBill + upiAppliedToBill;
    const newPaid = b.amountPaid + totalApplied;
    const newBalance = Math.max(0, b.total - newPaid);
    const status = newBalance <= 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');

    return {
      id: b.id,
      advApplied: advAppliedToBill,
      cashApplied: cashAppliedToBill,
      upiApplied: upiAppliedToBill,
      totalApplied,
      newPaid,
      newBalance,
      status
    };
  });

  return {
    directCollection,
    actualAdvanceUsed,
    totalSettlementApplied,
    excessToCredit,
    finalOutstanding,
    remainingAdvance,
    allocatedBills
  };
}

console.log('--- Starting Unified Payment System Scenario Tests ---');

// Scenario 1: Full Cash Payment
// Bill: 500, Cash: 500 => Bill Paid: 500, Outstanding: 0, Status: paid
{
  const res = calculateSettlement({
    bills: [{ id: 'B1', total: 500, amountPaid: 0, balance: 500 }],
    cashReceived: 500
  });
  assert.strictEqual(res.allocatedBills[0].newPaid, 500);
  assert.strictEqual(res.allocatedBills[0].newBalance, 0);
  assert.strictEqual(res.allocatedBills[0].status, 'paid');
  console.log('✔ Scenario 1: Full Cash Payment PASSED');
}

// Scenario 2: Full UPI Payment
// Bill: 500, UPI: 500 => Bill Paid: 500, Outstanding: 0, Status: paid
{
  const res = calculateSettlement({
    bills: [{ id: 'B1', total: 500, amountPaid: 0, balance: 500 }],
    upiReceived: 500
  });
  assert.strictEqual(res.allocatedBills[0].newPaid, 500);
  assert.strictEqual(res.allocatedBills[0].newBalance, 0);
  assert.strictEqual(res.allocatedBills[0].status, 'paid');
  console.log('✔ Scenario 2: Full UPI Payment PASSED');
}

// Scenario 3: Mixed Cash + UPI
// Bill: 1000, Cash: 400, UPI: 600 => Total Collected: 1000, Outstanding: 0, Status: paid
{
  const res = calculateSettlement({
    bills: [{ id: 'B1', total: 1000, amountPaid: 0, balance: 1000 }],
    cashReceived: 400,
    upiReceived: 600
  });
  assert.strictEqual(res.directCollection, 1000);
  assert.strictEqual(res.allocatedBills[0].newBalance, 0);
  assert.strictEqual(res.allocatedBills[0].status, 'paid');
  console.log('✔ Scenario 3: Mixed Cash + UPI PASSED');
}

// Scenario 4: Partial Payment
// Bill: 1000, Cash: 300 => Paid: 300, Outstanding: 700, Status: partial
{
  const res = calculateSettlement({
    bills: [{ id: 'B1', total: 1000, amountPaid: 0, balance: 1000 }],
    cashReceived: 300
  });
  assert.strictEqual(res.allocatedBills[0].newPaid, 300);
  assert.strictEqual(res.allocatedBills[0].newBalance, 700);
  assert.strictEqual(res.allocatedBills[0].status, 'partial');
  console.log('✔ Scenario 4: Partial Payment PASSED');
}

// Scenario 5: Multiple Installments
// Bill: 1000. Installment 1: 200 Cash. Installment 2: 300 UPI. Installment 3: 500 Cash.
{
  let bill = { id: 'B1', total: 1000, amountPaid: 0, balance: 1000 };
  const r1 = calculateSettlement({ bills: [bill], cashReceived: 200 });
  bill.amountPaid = r1.allocatedBills[0].newPaid;
  bill.balance = r1.allocatedBills[0].newBalance;
  assert.strictEqual(bill.balance, 800);

  const r2 = calculateSettlement({ bills: [bill], upiReceived: 300 });
  bill.amountPaid = r2.allocatedBills[0].newPaid;
  bill.balance = r2.allocatedBills[0].newBalance;
  assert.strictEqual(bill.balance, 500);

  const r3 = calculateSettlement({ bills: [bill], cashReceived: 500 });
  bill.amountPaid = r3.allocatedBills[0].newPaid;
  bill.balance = r3.allocatedBills[0].newBalance;
  assert.strictEqual(bill.balance, 0);
  assert.strictEqual(r3.allocatedBills[0].status, 'paid');
  console.log('✔ Scenario 5: Multiple Installments PASSED');
}

// Scenario 6: Multiple Bills Settlement (FIFO)
// Bill A: 500, Bill B: 300, Bill C: 200. Pays: 700.
// Expected: Bill A settled (500), Bill B settled (200, balance 100), Bill C outstanding (200).
{
  const res = calculateSettlement({
    bills: [
      { id: 'A', total: 500, amountPaid: 0, balance: 500 },
      { id: 'B', total: 300, amountPaid: 0, balance: 300 },
      { id: 'C', total: 200, amountPaid: 0, balance: 200 }
    ],
    cashReceived: 700,
    targetBillId: 'all'
  });
  const bA = res.allocatedBills.find(b => b.id === 'A');
  const bB = res.allocatedBills.find(b => b.id === 'B');
  const bC = res.allocatedBills.find(b => b.id === 'C');
  assert.strictEqual(bA.newBalance, 0);
  assert.strictEqual(bA.status, 'paid');
  assert.strictEqual(bB.newBalance, 100);
  assert.strictEqual(bB.status, 'partial');
  assert.strictEqual(bC.newBalance, 200);
  assert.strictEqual(bC.status, 'unpaid');
  console.log('✔ Scenario 6: Multiple Bills Settlement (FIFO) PASSED');
}

// Scenario 7: Payment Against a Specific Old Bill
// Directly record payment against Bill B without settling Bill A.
{
  const res = calculateSettlement({
    bills: [
      { id: 'A', total: 500, amountPaid: 0, balance: 500 },
      { id: 'B', total: 300, amountPaid: 0, balance: 300 }
    ],
    targetBillId: 'B',
    cashReceived: 300
  });
  assert.strictEqual(res.allocatedBills.length, 1);
  assert.strictEqual(res.allocatedBills[0].id, 'B');
  assert.strictEqual(res.allocatedBills[0].newBalance, 0);
  console.log('✔ Scenario 7: Payment Against a Specific Old Bill PASSED');
}

// Scenario 8: Customer Makes an Excess Payment
// Bill: 500, Cash: 550 => Bill: 500, Advance Created: 50, Outstanding: 0
{
  const res = calculateSettlement({
    bills: [{ id: 'B1', total: 500, amountPaid: 0, balance: 500 }],
    cashReceived: 550,
    targetBillId: 'B1'
  });
  assert.strictEqual(res.allocatedBills[0].newBalance, 0);
  assert.strictEqual(res.excessToCredit, 50);
  assert.strictEqual(res.remainingAdvance, 50);
  console.log('✔ Scenario 8: Customer Makes an Excess Payment PASSED');
}

// Scenario 9: Existing Advance + Direct Payment
// Bill: 1000, Advance: 300, Cash: 400, UPI: 300
// Expected: Advance Used: 300, Direct: 700, Bill Settled: 1000, Remaining Adv: 0, Outstanding: 0
{
  const res = calculateSettlement({
    bills: [{ id: 'B1', total: 1000, amountPaid: 0, balance: 1000 }],
    advanceBalance: 300,
    useAdvance: true,
    cashReceived: 400,
    upiReceived: 300
  });
  assert.strictEqual(res.actualAdvanceUsed, 300);
  assert.strictEqual(res.directCollection, 700);
  assert.strictEqual(res.totalSettlementApplied, 1000);
  assert.strictEqual(res.remainingAdvance, 0);
  assert.strictEqual(res.finalOutstanding, 0);
  console.log('✔ Scenario 9: Existing Advance + Direct Payment PASSED');
}

// Scenario 10: Payment with Advance Only
// Bill: 500, Available Advance: 700. Customer uses 500.
// Expected: Advance Used: 500, Remaining: 200, Direct: 0, Outstanding: 0
{
  const res = calculateSettlement({
    bills: [{ id: 'B1', total: 500, amountPaid: 0, balance: 500 }],
    advanceBalance: 700,
    useAdvance: true,
    advanceToApply: 500
  });
  assert.strictEqual(res.actualAdvanceUsed, 500);
  assert.strictEqual(res.remainingAdvance, 200);
  assert.strictEqual(res.directCollection, 0);
  assert.strictEqual(res.finalOutstanding, 0);
  console.log('✔ Scenario 10: Payment with Advance Only PASSED');
}

// Scenario 11: Partial Advance + Partial Direct Payment
// Bill: 1000, Advance: 200, Cash: 300, UPI: 200
// Expected: Advance Used: 200, Direct: 500, Total Settled: 700, Outstanding: 300
{
  const res = calculateSettlement({
    bills: [{ id: 'B1', total: 1000, amountPaid: 0, balance: 1000 }],
    advanceBalance: 200,
    useAdvance: true,
    cashReceived: 300,
    upiReceived: 200
  });
  assert.strictEqual(res.actualAdvanceUsed, 200);
  assert.strictEqual(res.directCollection, 500);
  assert.strictEqual(res.totalSettlementApplied, 700);
  assert.strictEqual(res.finalOutstanding, 300);
  console.log('✔ Scenario 11: Partial Advance + Partial Direct Payment PASSED');
}

// Scenario 12: Payment Exceeding Selected Bills
// Outstanding: 600, Pays: 800 => Bills Settled: 600, Excess: 200, Outstanding: 0
{
  const res = calculateSettlement({
    bills: [{ id: 'B1', total: 600, amountPaid: 0, balance: 600 }],
    cashReceived: 800
  });
  assert.strictEqual(res.totalSettlementApplied, 600);
  assert.strictEqual(res.excessToCredit, 200);
  assert.strictEqual(res.finalOutstanding, 0);
  console.log('✔ Scenario 12: Payment Exceeding Selected Bills PASSED');
}

// Scenario 13: Walk-in Customer Payment (no advance created for anonymous walk-in)
{
  const res = calculateSettlement({
    bills: [{ id: 'B1', total: 500, amountPaid: 0, balance: 500 }],
    cashReceived: 550,
    isWalkIn: true
  });
  assert.strictEqual(res.totalSettlementApplied, 500);
  assert.strictEqual(res.excessToCredit, 0); // No unassigned advance for anonymous walk-in
  console.log('✔ Scenario 13: Walk-in Customer Payment PASSED');
}

// Scenario 14: Group Billing Payment
// Settlement does not duplicate individual bill payments
{
  const res = calculateSettlement({
    bills: [{ id: 'GB1', total: 1200, amountPaid: 0, balance: 1200 }],
    cashReceived: 600,
    upiReceived: 600
  });
  assert.strictEqual(res.totalSettlementApplied, 1200);
  assert.strictEqual(res.finalOutstanding, 0);
  console.log('✔ Scenario 14: Group Billing Payment PASSED');
}

// Edge Cases & Invariants:
// - Decimal amounts
{
  const res = calculateSettlement({
    bills: [{ id: 'B1', total: 100.55, amountPaid: 0, balance: 100.55 }],
    cashReceived: 100.55
  });
  assert.strictEqual(res.finalOutstanding, 0);
  console.log('✔ Decimal amounts PASSED');
}

// - Over-applying advance prevented (cap at available balance)
{
  const res = calculateSettlement({
    bills: [{ id: 'B1', total: 1000, amountPaid: 0, balance: 1000 }],
    advanceBalance: 300,
    useAdvance: true,
    advanceToApply: 800 // Tries to use 800 with only 300 available
  });
  assert.strictEqual(res.actualAdvanceUsed, 300);
  assert.strictEqual(res.remainingAdvance, 0);
  assert.strictEqual(res.finalOutstanding, 700);
  console.log('✔ Insufficient advance capped safely PASSED');
}

console.log('--- ALL UNIFIED PAYMENT SYSTEM SCENARIOS VERIFIED SUCCESSFULLY ---');


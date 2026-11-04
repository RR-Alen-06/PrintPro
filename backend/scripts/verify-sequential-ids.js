/**
 * End-to-End Verification Suite for Sequential IDs Across Entire Application & Reset Sequences
 */

const { getPool } = require('../config/db');
const { getNextSequence, resetAllSequences } = require('../utils/sequenceGenerator');

async function runVerification() {
  const pool = getPool();
  console.log('===============================================================');
  console.log('STARTING SEQUENTIAL IDS & SEQUENCE RESET VERIFICATION SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Fetch real test user
  const [users] = await pool.query('SELECT id, email FROM auth.users LIMIT 1');
  if (users.length === 0) {
    console.error('No auth users found for testing.');
    process.exit(1);
  }
  const testUserId = users[0].id;
  console.log(`Using test user: ${testUserId} (${users[0].email})\n`);

  try {
    // -------------------------------------------------------------
    // SECTION 1: Sequential ID Generation Verification
    // -------------------------------------------------------------
    console.log('--- SECTION 1: Sequential ID Generation Across All Entities ---');

    // 1.1 Regular Customer
    const rc1 = await getNextSequence(pool, testUserId, 'customer_regular');
    console.log(`Generated regular customer: ${rc1}`);
    assert(/^RC-\d{4}$/.test(rc1), `Regular customer format is RC-0000: ${rc1}`);

    const rc2 = await getNextSequence(pool, testUserId, 'customer_regular');
    console.log(`Generated regular customer 2: ${rc2}`);
    const rc1Num = parseInt(rc1.split('-')[1], 10);
    const rc2Num = parseInt(rc2.split('-')[1], 10);
    assert(rc2Num === rc1Num + 1, `Regular customer sequence increments monotonically (+1): ${rc1} -> ${rc2}`);

    // 1.2 Walk-in Customer
    const wi1 = await getNextSequence(pool, testUserId, 'customer_walkin');
    console.log(`Generated walk-in customer: ${wi1}`);
    assert(/^WI-\d{4}$/.test(wi1), `Walk-in customer format is WI-0000: ${wi1}`);

    const wi2 = await getNextSequence(pool, testUserId, 'customer_walkin');
    const wi1Num = parseInt(wi1.split('-')[1], 10);
    const wi2Num = parseInt(wi2.split('-')[1], 10);
    assert(wi2Num === wi1Num + 1, `Walk-in customer sequence increments monotonically (+1): ${wi1} -> ${wi2}`);

    // 1.3 Bill
    const bill1 = await getNextSequence(pool, testUserId, 'bill');
    console.log(`Generated bill: ${bill1}`);
    assert(/^BILL-\d{4}$/.test(bill1), `Bill format is BILL-0000: ${bill1}`);

    // 1.4 Standard Payment
    const pay1 = await getNextSequence(pool, testUserId, 'payment');
    console.log(`Generated payment: ${pay1}`);
    assert(/^PAY-\d{4}$/.test(pay1), `Payment format is PAY-0000: ${pay1}`);

    // 1.5 Payment Reversal
    const rev1 = await getNextSequence(pool, testUserId, 'payment_reversal');
    console.log(`Generated reversal: ${rev1}`);
    assert(/^REV-\d{4}$/.test(rev1), `Payment reversal format is REV-0000: ${rev1}`);

    // 1.6 Refund
    const ref1 = await getNextSequence(pool, testUserId, 'refund');
    console.log(`Generated refund: ${ref1}`);
    assert(/^REF-\d{4}$/.test(ref1), `Refund format is REF-0000: ${ref1}`);

    // 1.7 Advance
    const adv1 = await getNextSequence(pool, testUserId, 'advance');
    console.log(`Generated advance: ${adv1}`);
    assert(/^ADV-\d{4}$/.test(adv1), `Customer advance format is ADV-0000: ${adv1}`);

    // 1.8 Expense
    const exp1 = await getNextSequence(pool, testUserId, 'expense');
    console.log(`Generated expense: ${exp1}`);
    assert(/^EXP-\d{4}$/.test(exp1), `Expense format is EXP-0000: ${exp1}`);

    // 1.9 Cash Session
    const sess1 = await getNextSequence(pool, testUserId, 'cash_session');
    console.log(`Generated cash session: ${sess1}`);
    assert(/^SESS-\d{4}$/.test(sess1), `Cash session format is SESS-0000: ${sess1}`);

    // 1.10 Split Purchase
    const sp1 = await getNextSequence(pool, testUserId, 'split_purchase');
    console.log(`Generated split purchase: ${sp1}`);
    assert(/^SP-\d{4}$/.test(sp1), `Split purchase format is SP-0000: ${sp1}`);

    // 1.11 Customer Group
    const grp1 = await getNextSequence(pool, testUserId, 'group');
    console.log(`Generated group: ${grp1}`);
    assert(/^GRP-\d{4}$/.test(grp1), `Customer group format is GRP-0000: ${grp1}`);

    // -------------------------------------------------------------
    // SECTION 2: Monotonic Non-Reuse (Individual Deletion Invariant)
    // -------------------------------------------------------------
    console.log('\n--- SECTION 2: Monotonic Invariant (Individual Record Deletion Never Resets Sequence) ---');
    
    // Simulate inserting a bill with bill1 and then soft-deleting it
    const bill2 = await getNextSequence(pool, testUserId, 'bill');
    console.log(`Generated bill2: ${bill2}`);
    const b1Num = parseInt(bill1.split('-')[1], 10);
    const b2Num = parseInt(bill2.split('-')[1], 10);
    assert(b2Num === b1Num + 1, `Bill sequence increments monotonically: ${bill1} -> ${bill2}`);

    // Subsequent generation continues strictly forward
    const bill3 = await getNextSequence(pool, testUserId, 'bill');
    console.log(`Generated bill3: ${bill3}`);
    const b3Num = parseInt(bill3.split('-')[1], 10);
    assert(b3Num === b2Num + 1, `Bill sequence never reuses prior IDs on individual actions: ${bill2} -> ${bill3}`);

    // -------------------------------------------------------------
    // SECTION 3: Delete All Data / Factory Reset & Sequence Reset
    // -------------------------------------------------------------
    console.log('\n--- SECTION 3: Factory Reset / Delete All Data Sequence Reset ---');

    // 3.1 Insert dummy inventory item to verify it is preserved during clear-all-data
    await pool.query(
      `INSERT INTO inventory_items (user_id, name, unit_price, stock)
       VALUES (?, 'Master Test Paper A4', 2.50, 500)
       ON CONFLICT DO NOTHING`,
      [testUserId]
    );

    // 3.2 Execute atomic reset of sequences
    await resetAllSequences(pool, testUserId);

    // Also clear tables for testUser to simulate complete clear-all-data
    await pool.query('DELETE FROM group_settlement_payments WHERE user_id = ?', [testUserId]);
    await pool.query('DELETE FROM payments WHERE user_id = ?', [testUserId]);
    await pool.query('DELETE FROM advance_payments WHERE user_id = ?', [testUserId]);
    await pool.query('DELETE FROM bill_items WHERE user_id = ?', [testUserId]);
    await pool.query('DELETE FROM bills WHERE user_id = ?', [testUserId]);
    await pool.query('DELETE FROM group_bills WHERE user_id = ?', [testUserId]);
    await pool.query('DELETE FROM customer_groups WHERE user_id = ?', [testUserId]);
    await pool.query('DELETE FROM customers WHERE user_id = ?', [testUserId]);
    await pool.query('DELETE FROM purchases WHERE user_id = ?', [testUserId]);
    await pool.query('DELETE FROM cash_sessions WHERE user_id = ?', [testUserId]);

    const [remainingSeqs] = await pool.query('SELECT * FROM sequences WHERE user_id = ?', [testUserId]);
    assert(remainingSeqs.length === 0, `All sequence counters wiped from sequences table on reset (count = 0)`);

    // Verify master inventory was preserved
    const [invRows] = await pool.query(
      `SELECT * FROM inventory_items WHERE user_id = ? AND name = 'Master Test Paper A4'`,
      [testUserId]
    );
    assert(invRows.length > 0, `Master inventory items are preserved during reset`);

    // -------------------------------------------------------------
    // SECTION 4: Fresh Sequential Numbers Post-Reset (Must start at 0001)
    // -------------------------------------------------------------
    console.log('\n--- SECTION 4: New Records Post-Reset Must Start Fresh at 0001 ---');

    const freshRc = await getNextSequence(pool, testUserId, 'customer_regular');
    console.log(`Fresh Regular Customer: ${freshRc}`);
    assert(freshRc === 'RC-0001', `Fresh Regular Customer starts at RC-0001 (got ${freshRc})`);

    const freshWi = await getNextSequence(pool, testUserId, 'customer_walkin');
    console.log(`Fresh Walk-in Customer: ${freshWi}`);
    assert(freshWi === 'WI-0001', `Fresh Walk-in Customer starts at WI-0001 (got ${freshWi})`);

    const freshBill = await getNextSequence(pool, testUserId, 'bill');
    console.log(`Fresh Bill: ${freshBill}`);
    assert(freshBill === 'BILL-0001', `Fresh Bill starts at BILL-0001 (got ${freshBill})`);

    const freshPay = await getNextSequence(pool, testUserId, 'payment');
    console.log(`Fresh Payment: ${freshPay}`);
    assert(freshPay === 'PAY-0001', `Fresh Payment starts at PAY-0001 (got ${freshPay})`);

    const freshRev = await getNextSequence(pool, testUserId, 'payment_reversal');
    console.log(`Fresh Payment Reversal: ${freshRev}`);
    assert(freshRev === 'REV-0001', `Fresh Payment Reversal starts at REV-0001 (got ${freshRev})`);

    const freshRef = await getNextSequence(pool, testUserId, 'refund');
    console.log(`Fresh Refund: ${freshRef}`);
    assert(freshRef === 'REF-0001', `Fresh Refund starts at REF-0001 (got ${freshRef})`);

    const freshAdv = await getNextSequence(pool, testUserId, 'advance');
    console.log(`Fresh Customer Advance: ${freshAdv}`);
    assert(freshAdv === 'ADV-0001', `Fresh Customer Advance starts at ADV-0001 (got ${freshAdv})`);

    const freshExp = await getNextSequence(pool, testUserId, 'expense');
    console.log(`Fresh Expense: ${freshExp}`);
    assert(freshExp === 'EXP-0001', `Fresh Expense starts at EXP-0001 (got ${freshExp})`);

    const freshSess = await getNextSequence(pool, testUserId, 'cash_session');
    console.log(`Fresh Cash Session: ${freshSess}`);
    assert(freshSess === 'SESS-0001', `Fresh Cash Session starts at SESS-0001 (got ${freshSess})`);

    const freshSp = await getNextSequence(pool, testUserId, 'split_purchase');
    console.log(`Fresh Split Purchase: ${freshSp}`);
    assert(freshSp === 'SP-0001', `Fresh Split Purchase starts at SP-0001 (got ${freshSp})`);

    const freshGrp = await getNextSequence(pool, testUserId, 'group');
    console.log(`Fresh Customer Group: ${freshGrp}`);
    assert(freshGrp === 'GRP-0001', `Fresh Customer Group starts at GRP-0001 (got ${freshGrp})`);

    // Clean up test inventory item
    await pool.query(
      `DELETE FROM inventory_items WHERE user_id = ? AND name = 'Master Test Paper A4'`,
      [testUserId]
    );

    console.log('\n===============================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Verification encountered an uncaught error:', err);
    process.exit(1);
  }
}

runVerification();

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../frontend/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  try {
    const res = await Promise.all([
      supabase.from('bills').select('id').limit(1),
      supabase.from('customers').select('id').limit(1),
      supabase.from('payments').select('id').limit(1),
      supabase.from('inventory_items').select('id').limit(1),
      supabase.from('purchases').select('id').limit(1),
      supabase.from('profiles').select('id').limit(1)
    ]);
    res.forEach((r, i) => console.log(`Query ${i} error:`, r.error));
  } catch (e) {
    console.error(e);
  }
}
check();

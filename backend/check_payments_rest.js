require('dotenv').config({ path: '../frontend/.env' });

async function check() {
  const url1 = process.env.VITE_SUPABASE_URL + '/rest/v1/payments?select=*';
  const url2 = process.env.VITE_SUPABASE_URL + '/rest/v1/advance_payments?select=*';
  
  const headers = {
    'apikey': process.env.VITE_SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + process.env.VITE_SUPABASE_ANON_KEY
  };
  
  const res1 = await fetch(url1, { headers });
  console.log("PAYMENTS:");
  console.log(await res1.json());
  
  const res2 = await fetch(url2, { headers });
  console.log("ADVANCE PAYMENTS:");
  console.log(await res2.json());
}
check();

require('dotenv').config({ path: '../frontend/.env' });

async function check() {
  const url = process.env.VITE_SUPABASE_URL + '/rest/v1/inventory_items?select=*';
  const res = await fetch(url, {
    headers: {
      'apikey': process.env.VITE_SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + process.env.VITE_SUPABASE_ANON_KEY
    }
  });
  const data = await res.json();
  console.log(data);
}
check();

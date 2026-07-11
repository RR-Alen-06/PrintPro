const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const pool = new Pool({
  host: `db.latjtnhjvmbmnrhznpfx.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: `postgres`,
  password: dbPassword,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query('SELECT * FROM payments');
    console.log("PAYMENTS:");
    console.table(res.rows);
    
    const res2 = await pool.query('SELECT * FROM bills');
    console.log("BILLS:");
    console.table(res2.rows);

    const res3 = await pool.query('SELECT * FROM inventory_items');
    console.log("INVENTORY:");
    console.table(res3.rows);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
check();

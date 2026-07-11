const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new Pool({
  host: `aws-0-ap-south-1.pooler.supabase.com`,
  port: 6543,
  database: 'postgres',
  user: `postgres.${process.env.SUPABASE_URL.split('//')[1]?.split('.')[0]}`,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query('SELECT * FROM payments');
    console.log("PAYMENTS:");
    console.table(res.rows);
    const res2 = await pool.query('SELECT * FROM advance_payments');
    console.log("ADVANCE PAYMENTS:");
    console.table(res2.rows);
  } finally {
    pool.end();
  }
}
check();

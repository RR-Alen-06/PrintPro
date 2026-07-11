const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!projectRef || !dbPassword) {
  console.error("Missing db config");
  process.exit(1);
}

const pool = new Pool({
  host: `aws-0-ap-south-1.pooler.supabase.com`,
  port: 6543,
  database: 'postgres',
  user: `postgres.${projectRef}`,
  password: dbPassword,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query('SELECT * FROM inventory_items');
    console.log("INVENTORY ITEMS:");
    console.table(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
check();

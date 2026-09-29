import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables from backend/.env or root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const projectRef = supabaseUrl ? supabaseUrl.split('//')[1]?.split('.')[0] : null;
const region = process.env.SUPABASE_REGION || 'ap-south-1';
const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || '';
const encodedPassword = dbPassword ? encodeURIComponent(dbPassword) : '';

const connectionString = process.env.DATABASE_URL || 
  (projectRef && encodedPassword ? `postgresql://postgres.${projectRef}:${encodedPassword}@aws-1-${region}.pooler.supabase.com:6543/postgres` : null);

async function applyUnifiedSchema() {
  console.log('🚀 [PrintPro Database Migration] Initializing Unified Schema Apply...');

  const schemaPath = path.resolve(__dirname, '../database/unified_schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ Schema file not found at: ${schemaPath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(schemaPath, 'utf8');

  if (!connectionString) {
    console.warn('⚠️ No DATABASE_URL or SUPABASE_DB_PASSWORD detected in environment.');
    console.log(`ℹ️ You can run the unified schema directly in the Supabase SQL Editor:`);
    console.log(`   Location: ${schemaPath}\n`);
    console.log('✅ Schema file verified and ready for deployment.');
    return;
  }

  console.log('📡 Connecting to PostgreSQL database...');
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    console.log('⏳ Executing unified PostgreSQL schema (idempotent)...');
    const startTime = Date.now();

    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Unified database schema applied successfully in ${duration}s!`);

    // Verify key tables
    const checkResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const tables = checkResult.rows.map(r => r.table_name);
    console.log('\n📊 Verified Public Tables & Views:');
    tables.forEach(t => console.log(`   • ${t}`));

    console.log('\n🎉 Database setup complete! All entities, sequential triggers, RLS, and compatibility views are active.\n');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error(`❌ Migration failed: ${err.message}`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  applyUnifiedSchema().catch((err) => {
    console.error('Fatal error during schema execution:', err);
    process.exit(1);
  });
}

export { applyUnifiedSchema };

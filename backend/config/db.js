const { Pool } = require('pg');
const logger = require('../utils/logger');

// Validate PostgreSQL credentials in environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl) {
  throw new Error('Database configuration error: Required environment variable "SUPABASE_URL" is missing.');
}
if (!supabaseAnonKey) {
  throw new Error('Database configuration error: Required environment variable "SUPABASE_PUBLISHABLE_KEY" or "SUPABASE_ANON_KEY" is missing.');
}

// Parse project reference from Supabase URL (e.g., https://latjtnhjvmbmnrhznpfx.supabase.co -> latjtnhjvmbmnrhznpfx)
const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
if (!projectRef) {
  throw new Error('Database configuration error: Invalid SUPABASE_URL format.');
}

// Region is ap-south-1 (Mumbai) as returned by Supabase list_projects
const region = 'ap-south-1';

// Build the IPv4-compatible Supabase Connection Pooler URL (Transaction Mode - Port 6543)
// Username format is: postgres.[project-ref]
const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || 'cek@123'; // fallback, user should set in env
const encodedPassword = encodeURIComponent(dbPassword);
const connectionString = process.env.DATABASE_URL || 
  `postgresql://postgres.${projectRef}:${encodedPassword}@aws-1-${region}.pooler.supabase.com:6543/postgres`;

logger.info(`Database config initialized using pooler host for project "${projectRef}"`);

const pgPool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false } // Required for Supabase PostgreSQL connections
});

class PgConnectionWrapper {
  constructor(client) {
    this.client = client;
  }

  translateQuery(sql, values = []) {
    let pgSql = sql;
    let paramIndex = 1;

    // Replace '?' placeholders with '$1', '$2', etc.
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    // Translate MySQL DATE_FORMAT to PostgreSQL TO_CHAR
    pgSql = pgSql.replace(/DATE_FORMAT\(([^,]+),\s*['"]%Y-%m['"]\)/gi, "TO_CHAR($1, 'YYYY-MM')");

    // Translate MySQL YEAR() and MONTH()
    pgSql = pgSql.replace(/YEAR\(([^)]+)\)/gi, "EXTRACT(YEAR FROM $1)");
    pgSql = pgSql.replace(/MONTH\(([^)]+)\)/gi, "EXTRACT(MONTH FROM $1)");

    // Translate MySQL AS UNSIGNED cast
    pgSql = pgSql.replace(/AS UNSIGNED/gi, 'AS INTEGER');

    // Automatically append RETURNING * on INSERT queries if it's missing to extract insertId
    if (pgSql.trim().toUpperCase().startsWith('INSERT ') && !pgSql.toUpperCase().includes(' RETURNING ')) {
      pgSql += ' RETURNING *';
    }

    return pgSql;
  }

  async query(sql, values = []) {
    const pgSql = this.translateQuery(sql, values);
    const result = await this.client.query(pgSql, values);
    
    // Package rows according to mysql2 expectations
    const rows = result.rows;

    if (result.command === 'INSERT' || result.command === 'UPDATE' || result.command === 'DELETE') {
      const affectedRows = result.rowCount;
      const insertId = result.rows[0]?.id || null;
      return [{ insertId, affectedRows, warningStatus: 0 }, null];
    }

    return [rows, null];
  }

  async beginTransaction() {
    await this.client.query('BEGIN');
  }

  async commit() {
    await this.client.query('COMMIT');
  }

  async rollback() {
    await this.client.query('ROLLBACK');
  }

  release() {
    this.client.release();
  }
}

class PgPoolWrapper {
  constructor(pool) {
    this.pool = pool;
    this.connectionLimit = 10;
  }

  translateQuery(sql, values = []) {
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
    pgSql = pgSql.replace(/DATE_FORMAT\(([^,]+),\s*['"]%Y-%m['"]\)/gi, "TO_CHAR($1, 'YYYY-MM')");
    pgSql = pgSql.replace(/YEAR\(([^)]+)\)/gi, "EXTRACT(YEAR FROM $1)");
    pgSql = pgSql.replace(/MONTH\(([^)]+)\)/gi, "EXTRACT(MONTH FROM $1)");
    pgSql = pgSql.replace(/AS UNSIGNED/gi, 'AS INTEGER');

    if (pgSql.trim().toUpperCase().startsWith('INSERT ') && !pgSql.toUpperCase().includes(' RETURNING ')) {
      pgSql += ' RETURNING *';
    }
    return pgSql;
  }

  async query(sql, values = []) {
    const pgSql = this.translateQuery(sql, values);
    const result = await this.pool.query(pgSql, values);
    const rows = result.rows;

    if (result.command === 'INSERT' || result.command === 'UPDATE' || result.command === 'DELETE') {
      const affectedRows = result.rowCount;
      const insertId = result.rows[0]?.id || null;
      return [{ insertId, affectedRows, warningStatus: 0 }, null];
    }

    return [rows, null];
  }

  async getConnection() {
    const client = await this.pool.connect();
    return new PgConnectionWrapper(client);
  }
}

const wrapperPool = new PgPoolWrapper(pgPool);

async function initializeDatabase() {
  try {
    // Quick probe query to confirm successful connection
    const client = await pgPool.connect();
    logger.info('Successfully connected to Supabase PostgreSQL database.');
    client.release();
  } catch (err) {
    logger.error(`Failed to connect to Supabase PostgreSQL database: ${err.message}`);
    throw err;
  }
  return wrapperPool;
}

function getPool() {
  return wrapperPool;
}

module.exports = { initializeDatabase, getPool };

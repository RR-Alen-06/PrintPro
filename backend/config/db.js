const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../backend/.env') });

const { Pool } = require('pg');
const logger = require('../utils/logger');

let pgPool = null;
let wrapperPool = null;

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://latjtnhjvmbmnrhznpfx.supabase.co';
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  const projectRef = supabaseUrl.includes('//') ? supabaseUrl.split('//')[1]?.split('.')[0] : supabaseUrl.split('.')[0];
  const region = process.env.SUPABASE_REGION || 'ap-south-1';

  let connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;
    if (dbPassword && projectRef) {
      const encodedPassword = encodeURIComponent(dbPassword);
      connectionString = `postgresql://postgres.${projectRef}:${encodedPassword}@aws-1-${region}.pooler.supabase.com:6543/postgres`;
    }
  }

  return { supabaseUrl, supabaseKey, projectRef, region, connectionString };
}

function createPool() {
  const { connectionString, projectRef } = getSupabaseConfig();
  if (!connectionString) {
    throw new Error('Database configuration error: Required environment variable "SUPABASE_DB_PASSWORD" or "DATABASE_URL" is missing.');
  }

  logger.info(`Database config initialized using pooler host for project "${projectRef}"`);
  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Required for Supabase PostgreSQL connections
    max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT, 10) || 10000,
  });
}

class PgConnectionWrapper {
  constructor(client) {
    this.client = client;
    this.inTransaction = false;
  }

  translateQuery(sql) {
    let pgSql = sql;
    let paramIndex = 1;

    // Replace '?' placeholders with '$1', '$2', etc.
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    // Translate MySQL DATE_FORMAT to PostgreSQL TO_CHAR
    pgSql = pgSql.replace(/DATE_FORMAT\(([^,]+),\s*['"]%Y-%m['"]\)/gi, "TO_CHAR($1, 'YYYY-MM')");

    // Translate MySQL YEAR() and MONTH()
    pgSql = pgSql.replace(/YEAR\(([^)]+)\)/gi, "EXTRACT(YEAR FROM $1)");
    pgSql = pgSql.replace(/MONTH\(([^)]+)\)/gi, "EXTRACT(MONTH FROM $1)");

    // Translate MySQL CURDATE() to PostgreSQL CURRENT_DATE
    pgSql = pgSql.replace(/CURDATE\(\)/gi, 'CURRENT_DATE');

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
      const header = Object.assign({}, result.rows[0] || {}, { insertId, affectedRows, warningStatus: 0 });
      return [header, null];
    }

    return [rows, null];
  }

  async beginTransaction() {
    await this.client.query('BEGIN');
    this.inTransaction = true;
  }

  async commit() {
    await this.client.query('COMMIT');
    this.inTransaction = false;
  }

  async rollback() {
    try {
      await this.client.query('ROLLBACK');
    } finally {
      this.inTransaction = false;
    }
  }

  release() {
    if (this.inTransaction) {
      this.inTransaction = false;
      logger.warn('Connection released while transaction was active; issuing safety ROLLBACK.');
      this.client.query('ROLLBACK').catch(err => {
        logger.error(`Error during safety transaction rollback on release: ${err.message}`);
      }).finally(() => {
        this.client.release();
      });
      return;
    }
    this.client.release();
  }
}

class PgPoolWrapper {
  constructor(pool) {
    this.pool = pool;
    this.connectionLimit = 10;
  }

  translateQuery(sql) {
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
    pgSql = pgSql.replace(/DATE_FORMAT\(([^,]+),\s*['"]%Y-%m['"]\)/gi, "TO_CHAR($1, 'YYYY-MM')");
    pgSql = pgSql.replace(/YEAR\(([^)]+)\)/gi, "EXTRACT(YEAR FROM $1)");
    pgSql = pgSql.replace(/MONTH\(([^)]+)\)/gi, "EXTRACT(MONTH FROM $1)");
    pgSql = pgSql.replace(/CURDATE\(\)/gi, 'CURRENT_DATE');
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
      const header = Object.assign({}, result.rows[0] || {}, { insertId, affectedRows, warningStatus: 0 });
      return [header, null];
    }

    return [rows, null];
  }

  async getConnection() {
    const client = await this.pool.connect();
    return new PgConnectionWrapper(client);
  }
}

function getPool() {
  if (!wrapperPool) {
    pgPool = createPool();
    wrapperPool = new PgPoolWrapper(pgPool);
  }
  return wrapperPool;
}

async function initializeDatabase() {
  try {
    const pool = getPool();
    const client = await pgPool.connect();
    logger.info('Successfully connected to Supabase PostgreSQL database.');
    client.release();
    return pool;
  } catch (err) {
    logger.error(`Failed to connect to Supabase PostgreSQL database: ${err.message}`);
    throw err;
  }
}

module.exports = { initializeDatabase, getPool, getSupabaseConfig };

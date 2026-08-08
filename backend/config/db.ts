import { Pool, PoolClient, types } from 'pg';
import logger from '../utils/logger';

// Parse PostgreSQL NUMERIC/DECIMAL (OID 1700) as floating point numbers
types.setTypeParser(1700, (val: string) => parseFloat(val));

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl) {
  throw new Error('Database configuration error: Required environment variable "SUPABASE_URL" or "VITE_SUPABASE_URL" is missing.');
}
if (!supabaseAnonKey) {
  throw new Error('Database configuration error: Required environment variable "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY" or "VITE_SUPABASE_ANON_KEY" is missing.');
}

const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
if (!projectRef) {
  throw new Error('Database configuration error: Invalid SUPABASE_URL format.');
}

const region = 'ap-south-1';
const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || 'cek@123';
const encodedPassword = encodeURIComponent(dbPassword);
const connectionString = process.env.DATABASE_URL || 
  `postgresql://postgres.${projectRef}:${encodedPassword}@aws-1-${region}.pooler.supabase.com:6543/postgres`;

logger.info(`Database config initialized using pooler host for project "${projectRef}"`);

const pgPool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

export class PgConnectionWrapper {
  private client: PoolClient;

  constructor(client: PoolClient) {
    this.client = client;
  }

  async query(sql: string, values: any[] = []): Promise<[any, any]> {
    const result = await this.client.query(sql, values);
    const rows = result.rows;

    if (result.command === 'INSERT' || result.command === 'UPDATE' || result.command === 'DELETE') {
      if (rows && rows.length > 0) {
        return [rows, null];
      }
      const affectedRows = result.rowCount;
      const insertId = null;
      return [{ insertId, affectedRows, warningStatus: 0 }, null];
    }

    return [rows, null];
  }

  async beginTransaction(): Promise<void> {
    await this.client.query('BEGIN');
  }

  async commit(): Promise<void> {
    await this.client.query('COMMIT');
  }

  async rollback(): Promise<void> {
    await this.client.query('ROLLBACK');
  }

  release(): void {
    this.client.release();
  }
}

export class PgPoolWrapper {
  private pool: Pool;
  public connectionLimit: number;

  constructor(pool: Pool) {
    this.pool = pool;
    this.connectionLimit = 10;
  }

  async query(sql: string, values: any[] = []): Promise<[any, any]> {
    const result = await this.pool.query(sql, values);
    const rows = result.rows;

    if (result.command === 'INSERT' || result.command === 'UPDATE' || result.command === 'DELETE') {
      if (rows && rows.length > 0) {
        return [rows, null];
      }
      const affectedRows = result.rowCount;
      const insertId = null;
      return [{ insertId, affectedRows, warningStatus: 0 }, null];
    }

    return [rows, null];
  }

  async getConnection(): Promise<PgConnectionWrapper> {
    const client = await this.pool.connect();
    return new PgConnectionWrapper(client);
  }
}

const wrapperPool = new PgPoolWrapper(pgPool);

export async function initializeDatabase(): Promise<PgPoolWrapper> {
  try {
    const client = await pgPool.connect();
    logger.info('Successfully connected to Supabase PostgreSQL database.');
    client.release();
  } catch (err: any) {
    logger.error(`Failed to connect to Supabase PostgreSQL database: ${err.message}`);
    throw err;
  }
  return wrapperPool;
}

export function getPool(): PgPoolWrapper {
  return wrapperPool;
}

export default { initializeDatabase, getPool };

const mysql  = require('mysql2/promise');
const fs     = require('fs');
const path   = require('path');
const logger = require('../utils/logger');

const dbConfig = {
  host:             process.env.DB_HOST     || 'localhost',
  port:             parseInt(process.env.DB_PORT, 10) || 3306,
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'printpro',
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0,
  multipleStatements: true,
};

let pool;

/**
 * Initialize the database:
 *   1. Create the DB if it doesn't exist.
 *   2. Run schema.sql if tables haven't been created yet.
 *   3. Create and expose the connection pool.
 */
async function initializeDatabase() {
  const dbName = dbConfig.database;

  // ── Bootstrap connection (no DB selected yet) ────────────────────────────
  const initConn = await mysql.createConnection({
    host:               dbConfig.host,
    port:               dbConfig.port,
    user:               dbConfig.user,
    password:           dbConfig.password,
    multipleStatements: true,
  });

  logger.info(`Connecting to MySQL at ${dbConfig.host}:${dbConfig.port} as "${dbConfig.user}"`);

  await initConn.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  logger.info(`Database "${dbName}" is ready`);

  await initConn.query(`USE \`${dbName}\``);

  // ── Check schema ──────────────────────────────────────────────────────────
  const [tables] = await initConn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.tables
     WHERE table_schema = ? AND table_name = 'business_profile'`,
    [dbName]
  );

  if (tables[0].cnt === 0) {
    logger.info('Schema not found — running schema.sql...');
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schemaSql  = fs.readFileSync(schemaPath, 'utf8');
    await initConn.query(schemaSql);
    logger.info('Schema created and seed data inserted');
  } else {
    logger.info('Schema already exists — skipping migration');
  }

  await initConn.end();

  // ── Create pool ───────────────────────────────────────────────────────────
  pool = mysql.createPool(dbConfig);
  logger.info(`Connection pool ready (limit: ${dbConfig.connectionLimit})`);

  return pool;
}

/**
 * Return the active pool. Throws if called before initializeDatabase().
 */
function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

module.exports = { initializeDatabase, getPool };

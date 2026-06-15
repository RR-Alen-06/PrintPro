const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'printpro',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true
};

let pool;

/**
 * Initialize the database: create the database if it does not exist,
 * then run schema.sql if the tables have not been created yet.
 */
async function initializeDatabase() {
  // First, connect without selecting a database to create it if needed
  const initConn = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    multipleStatements: true
  });

  const dbName = dbConfig.database;
  console.log(`[INFO] Checking if database "${dbName}" exists...`);

  await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  console.log(`[OK] Database "${dbName}" is ready.`);

  await initConn.query(`USE \`${dbName}\``);

  // Check if tables exist by looking for the business_profile table
  const [tables] = await initConn.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = 'business_profile'`,
    [dbName]
  );

  if (tables[0].cnt === 0) {
    console.log('[INFO] Tables not found. Running schema.sql...');
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await initConn.query(schemaSql);
    console.log('[OK] Schema created and seed data inserted.');
  } else {
    console.log('[OK] Tables already exist. Skipping schema setup.');
  }

  await initConn.end();

  // Now create the connection pool for app usage
  pool = mysql.createPool(dbConfig);
  console.log('[OK] MySQL connection pool created.');

  return pool;
}

/**
 * Get the active connection pool. Must call initializeDatabase() first.
 */
function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

module.exports = { initializeDatabase, getPool };

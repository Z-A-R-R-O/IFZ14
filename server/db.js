import mysql from 'mysql2/promise';

let pool;

export function getDbPool() {
  if (pool) return pool;

  const {
    DB_HOST = '127.0.0.1',
    DB_PORT = '3306',
    DB_USER = 'root',
    DB_PASSWORD = '',
    DB_NAME = 'ifz14',
    DB_CONNECTION_LIMIT = '10',
  } = process.env;

  pool = mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(DB_CONNECTION_LIMIT),
    namedPlaceholders: true,
  });

  return pool;
}

export async function checkDbHealth() {
  const connection = await getDbPool().getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

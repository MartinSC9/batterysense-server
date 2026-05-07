require('dotenv').config();
const pool = require('./db');

const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'cliente_user',
    ubidots_device_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

async function init() {
  try {
    await pool.query(schema);
    console.log('Database tables created successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    await pool.end();
  }
}

init();

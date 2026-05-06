require('dotenv').config();
const pool = require('./db');

const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'cliente_user',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    ubidots_id VARCHAR(50) UNIQUE,
    label VARCHAR(100) NOT NULL,
    name VARCHAR(150),
    owner_id INT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS device_variables (
    id SERIAL PRIMARY KEY,
    device_id INT REFERENCES devices(id) ON DELETE CASCADE,
    ubidots_id VARCHAR(50) UNIQUE,
    label VARCHAR(100) NOT NULL,
    name VARCHAR(150),
    last_value JSONB,
    last_activity TIMESTAMPTZ,
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

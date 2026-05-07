require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seed() {
  try {
    const hash = await bcrypt.hash('Admin123!', 10);

    await pool.query(`
      INSERT INTO users (name, email, password_hash, role, ubidots_device_id) VALUES
        ('Admin TRISO', 'admin@triso.com', $1, 'triso_admin', NULL),
        ('Técnico TRISO', 'tecnico@triso.com', $1, 'triso_tecnico', NULL),
        ('Ricardo Juarez', 'rjuarez@telecom-cba.com.ar', $1, 'cliente_admin', '696fff8f7a593a3f8b426592'),
        ('Usuario Demo', 'demo@batterysense.com', $1, 'cliente_admin', '696fff8f7a593a3f8b426592')
      ON CONFLICT (email) DO NOTHING
    `, [hash]);

    console.log('Seed completed');
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await pool.end();
  }
}

seed();

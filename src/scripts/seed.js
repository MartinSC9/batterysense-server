require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seed() {
  try {
    const hash = await bcrypt.hash('Admin123!', 10);

    await pool.query(`
      INSERT INTO users (name, email, password_hash, role) VALUES
        ('Admin TRISO', 'admin@triso.com', $1, 'triso_admin'),
        ('Técnico TRISO', 'tecnico@triso.com', $1, 'triso_tecnico'),
        ('Ricardo Juarez', 'rjuarez@telecom-cba.com.ar', $1, 'cliente_admin')
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

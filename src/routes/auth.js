const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../config/db');

const ROLE_MAP = {
  cliente_admin: 'cliente',
  cliente_user: 'subcliente',
  triso_tecnico: 'tecnico',
  triso_admin: 'admin',
};

// Rate limit estricto para auth — 10 intentos / 15 min por IP
const authLimiter = rateLimit({
  windowMs: 15 * 60000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, espera 15 minutos' },
});

router.post('/check-email', authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });

  try {
    const { rows } = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    res.json({ exists: rows.length > 0 });
  } catch (err) {
    console.error('Check email error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const frontendRole = ROLE_MAP[user.role] || user.role;
    const payload = { id: user.id, email: user.email, name: user.name, role: frontendRole };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: payload });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;

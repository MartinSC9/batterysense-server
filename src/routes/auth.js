const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const ROLE_MAP = {
  cliente_admin: 'cliente',
  cliente_user: 'subcliente',
  triso_tecnico: 'tecnico',
  triso_admin: 'admin',
};

router.post('/login', async (req, res) => {
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

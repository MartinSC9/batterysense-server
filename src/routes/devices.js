const router = require('express').Router();
const pool = require('../config/db');
const authenticate = require('../middleware/auth');

// GET /devices/mine/variables — variables del dispositivo del usuario
router.get('/mine/variables', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT dv.label, dv.name, dv.last_value AS "lastValue", dv.last_activity AS "lastActivity"
       FROM device_variables dv
       JOIN devices d ON d.id = dv.device_id
       WHERE d.owner_id = $1
       ORDER BY dv.label`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching variables:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;

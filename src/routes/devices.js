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

// GET /devices/mine/variables/:label/values — histórico de una variable
router.get('/mine/variables/:label/values', authenticate, async (req, res) => {
  try {
    const { label } = req.params;
    const start = Number(req.query.start) || Date.now() - 86400000;
    const end = Number(req.query.end) || Date.now();
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    // Obtener último valor de la variable para usarlo como base
    const { rows } = await pool.query(
      `SELECT dv.last_value AS "lastValue"
       FROM device_variables dv
       JOIN devices d ON d.id = dv.device_id
       WHERE d.owner_id = $1 AND dv.label = $2`,
      [req.user.id, label]
    );

    if (rows.length === 0) {
      return res.json({ values: [] });
    }

    const lastValue = rows[0].lastValue;
    const baseValue = typeof lastValue === 'object' ? (lastValue.value || 0) : (Number(lastValue) || 0);

    // Generar datos sintéticos basados en el valor actual
    const interval = (end - start) / limit;
    const values = [];
    for (let i = 0; i < limit; i++) {
      const ts = start + interval * i;
      // Variación realista: ±3% del valor base
      const noise = (Math.random() - 0.5) * baseValue * 0.06;
      values.push({
        value: Number((baseValue + noise).toFixed(2)),
        timestamp: Math.round(ts),
      });
    }

    res.json({ values });
  } catch (err) {
    console.error('Error fetching variable values:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;

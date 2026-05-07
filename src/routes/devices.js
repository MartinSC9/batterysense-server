const router = require('express').Router();
const pool = require('../config/db');
const ubidots = require('../services/ubidots');
const authenticate = require('../middleware/auth');

const LABEL_RE = /^[a-zA-Z0-9_-]{1,64}$/;

// Thresholds to filter garbage values from the concentrator firmware
const VALUE_LIMITS = {
  banco_v: { min: -500, max: 500 },
  banco_i: { min: -500, max: 500 },
  banco_celdas: { min: 0, max: 100 },
  alarma: { min: -10000, max: 10000 },
};

function getValueLimits(label) {
  if (label.endsWith('_v')) return VALUE_LIMITS.banco_v;
  if (label.endsWith('_i')) return VALUE_LIMITS.banco_i;
  if (label.endsWith('_celdas')) return VALUE_LIMITS.banco_celdas;
  if (label.startsWith('alarma')) return VALUE_LIMITS.alarma;
  return null;
}

function filterOutliers(values, label) {
  const limits = getValueLimits(label);
  if (!limits) return values;
  return values.filter(v => v.value >= limits.min && v.value <= limits.max);
}

// GET /api/devices/mine/variables
router.get('/mine/variables', authenticate, async (req, res) => {
  try {
    // Buscar ubidots_device_id del usuario
    const { rows } = await pool.query('SELECT ubidots_device_id FROM users WHERE id = $1', [req.user.id]);
    const ubidotsDeviceId = rows[0]?.ubidots_device_id;

    if (!ubidotsDeviceId) {
      return res.status(404).json({ error: 'No tenes un concentrador asignado' });
    }

    const variables = await ubidots.getDeviceVariables(ubidotsDeviceId);
    res.json(variables.map(v => {
      const limits = getValueLimits(v.label);
      const lastValue = (limits && v.lastValue && (v.lastValue.value < limits.min || v.lastValue.value > limits.max))
        ? { ...v.lastValue, value: null }
        : v.lastValue;
      return {
        id: v.id,
        label: v.label,
        name: v.name,
        lastValue,
        lastActivity: v.lastActivity,
      };
    }));
  } catch (err) {
    console.error('devices/mine/variables error:', err);
    res.status(500).json({ error: 'Error obteniendo variables' });
  }
});

// GET /api/devices/mine/variables/:label/values
router.get('/mine/variables/:label/values', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT ubidots_device_id FROM users WHERE id = $1', [req.user.id]);
    const ubidotsDeviceId = rows[0]?.ubidots_device_id;

    if (!ubidotsDeviceId) {
      return res.status(404).json({ error: 'No tenes un concentrador asignado' });
    }

    const { label } = req.params;
    if (!LABEL_RE.test(label)) {
      return res.status(400).json({ error: 'Label invalido' });
    }

    const variables = await ubidots.getDeviceVariables(ubidotsDeviceId);
    const variable = variables.find(v => v.label === label);
    if (!variable) {
      return res.status(404).json({ error: 'Variable no encontrada' });
    }

    const { start, end, limit } = req.query;
    const parsedStart = Number(start);
    const parsedEnd = Number(end);
    const parsedLimit = Number(limit);

    const values = await ubidots.getVariableValues(variable.id, {
      start: start && !isNaN(parsedStart) ? parsedStart : undefined,
      end: end && !isNaN(parsedEnd) ? parsedEnd : undefined,
      limit: limit && !isNaN(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 5000) : 100,
    });

    res.json({ variable: variable.label, values: filterOutliers(values, label) });
  } catch (err) {
    console.error('devices/variables/values error:', err);
    res.status(500).json({ error: 'Error obteniendo historial' });
  }
});

module.exports = router;

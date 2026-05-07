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

// GET /api/devices/mine/variables/:label/stats?period=today|week|month
router.get('/mine/variables/:label/stats', authenticate, async (req, res) => {
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

    const period = req.query.period || 'today';
    const tzOffset = parseInt(req.query.tz) || -180; // default Argentina UTC-3 = -180 min
    const now = Date.now();
    let start;
    if (period === 'today') {
      // Inicio del día en la zona horaria del cliente
      const clientNow = new Date(now - tzOffset * 60000);
      const midnight = new Date(clientNow);
      midnight.setUTCHours(0, 0, 0, 0);
      start = midnight.getTime() + tzOffset * 60000;
    } else {
      const periodMs = { hour: 3600000, week: 604800000, month: 2592000000 };
      start = now - (periodMs[period] || 86400000);
    }

    const rawValues = await ubidots.getVariableValues(variable.id, {
      start, end: now, limit: 5000,
    });
    const vals = filterOutliers(rawValues, label).sort((a, b) => a.timestamp - b.timestamp);

    if (!vals.length) {
      return res.json({ variable: label, period, min: null, max: null, avg: null, count: 0, points: [] });
    }

    const allValues = vals.map(v => v.value);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const avg = allValues.reduce((s, v) => s + v, 0) / allValues.length;

    let points;
    if (period === 'today' || period === 'hour') {
      // Raw points
      points = vals.map(v => ({
        timestamp: v.timestamp,
        value: Number(v.value.toFixed(1)),
      }));
    } else {
      // Aggregate by day
      const days = period === 'week' ? 7 : 30;
      const dayBuckets = {};
      for (let d = days - 1; d >= 0; d--) {
        const date = new Date(now - d * 86400000);
        const key = date.toISOString().slice(0, 10);
        dayBuckets[key] = [];
      }
      vals.forEach(v => {
        const key = new Date(v.timestamp).toISOString().slice(0, 10);
        if (dayBuckets[key]) dayBuckets[key].push(v.value);
      });

      points = Object.entries(dayBuckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .filter(([, b]) => b.length > 0)
        .map(([date, values]) => ({
          date,
          avg: Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1)),
          min: Number(Math.min(...values).toFixed(1)),
          max: Number(Math.max(...values).toFixed(1)),
          readings: values.length,
        }));
    }

    res.json({
      variable: label,
      period,
      min: Number(min.toFixed(1)),
      max: Number(max.toFixed(1)),
      avg: Number(avg.toFixed(1)),
      count: vals.length,
      points,
    });
  } catch (err) {
    console.error('devices/variables/stats error:', err);
    res.status(500).json({ error: 'Error calculando estadísticas' });
  }
});

module.exports = router;

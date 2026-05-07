require('dotenv').config();
const pool = require('../config/db');

async function seedData() {
  try {
    // Crear dispositivo para Ricardo Juarez (id=3)
    const { rows: [device] } = await pool.query(`
      INSERT INTO devices (ubidots_id, label, name, owner_id)
      VALUES ('ubidots-001', 'concentrador-telecom', 'Concentrador Telecom CBA', 3)
      ON CONFLICT (ubidots_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);

    const deviceId = device.id;
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;
    const tenMinAgo = now - 10 * 60 * 1000;

    // Variables por banco
    const bancos = [
      { num: 1, v: 52.4, i: 12.3, celdas: 95 },
      { num: 2, v: 51.8, i: 11.7, celdas: 92 },
      { num: 3, v: 53.1, i: 13.1, celdas: 98 },
      { num: 4, v: 50.2, i: 10.5, celdas: 88 },
    ];

    const variables = [];

    for (const b of bancos) {
      variables.push({
        label: `banco${b.num}_v`,
        name: `Banco ${b.num} - Voltaje`,
        lastValue: { value: b.v, timestamp: fiveMinAgo, context: {} },
      });
      variables.push({
        label: `banco${b.num}_i`,
        name: `Banco ${b.num} - Corriente`,
        lastValue: { value: b.i, timestamp: fiveMinAgo, context: {} },
      });
      variables.push({
        label: `banco${b.num}_celdas`,
        name: `Banco ${b.num} - Celdas OK`,
        lastValue: { value: b.celdas, timestamp: fiveMinAgo, context: {} },
      });
    }

    // Alarmas activas
    variables.push({
      label: 'alarma1',
      name: 'Alarma 1',
      lastValue: {
        value: 2.5,
        timestamp: tenMinAgo,
        context: { nombre: 'Voltaje bajo en celda', banco: 4, celda: 3 },
      },
    });
    variables.push({
      label: 'alarma2',
      name: 'Alarma 2',
      lastValue: {
        value: 3.1,
        timestamp: fiveMinAgo,
        context: { nombre: 'Temperatura elevada', banco: 2, celda: 7 },
      },
    });

    // alarma3-7 sin alarma activa (value 0)
    for (let i = 3; i <= 7; i++) {
      variables.push({
        label: `alarma${i}`,
        name: `Alarma ${i}`,
        lastValue: { value: 0, timestamp: now, context: {} },
      });
    }

    // Insertar variables
    for (const v of variables) {
      await pool.query(`
        INSERT INTO device_variables (device_id, ubidots_id, label, name, last_value, last_activity)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (ubidots_id) DO UPDATE SET
          last_value = EXCLUDED.last_value,
          last_activity = NOW()
      `, [deviceId, `var-${v.label}`, v.label, v.name, JSON.stringify(v.lastValue)]);
    }

    console.log(`Seeded ${variables.length} variables for device ${deviceId}`);
  } catch (err) {
    console.error('Seed data error:', err);
  } finally {
    await pool.end();
  }
}

seedData();

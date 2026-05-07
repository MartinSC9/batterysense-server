const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — solo orígenes permitidos
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5183')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Permitir requests sin origin (Postman, curl, health checks)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS not allowed'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// Trust proxy (Render usa proxy)
app.set('trust proxy', 1);

// Rate limit global — 100 req/min por IP
app.use(rateLimit({
  windowMs: 60000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta en 1 minuto' },
}));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

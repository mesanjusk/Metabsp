/**
 * Express app construction, split out from src/index.js so it can be
 * imported by tests (supertest) without triggering the process-level
 * bootstrap (DB connect, Socket.IO, seeding, server.listen).
 *
 * Metabsp (WhatsApp Cloud BSP) routes are mounted at their original paths:
 *   /api/users         — WhatsApp Cloud user management
 *   /api/whatsapp      — WhatsApp Cloud API
 *   /webhook           — Meta webhook
 *   /api/whatsapp/webhook — Meta webhook (alternate)
 *
 * Bulk-invite (WhatsApp Automation / Baileys) routes are mounted under /api/bulk/:
 *   /api/bulk/auth              — Bulk-invite auth (login, me)
 *   /api/bulk/org               — Organisation
 *   /api/bulk/dashboard         — Dashboard stats
 *   /api/bulk/roles             — Roles (CRUD)
 *   /api/bulk/users             — Bulk-invite user management
 *   /api/bulk/notifications     — Notifications (CRUD)
 *   /api/bulk/whatsapp          — WhatsApp Cloud / templates
 *   /api/bulk/baileys           — Baileys QR/session control
 *   /api/bulk/blasts            — WhatsApp blast messages
 *   /api/bulk/campaigns         — Campaign management
 *   /api/bulk/uploads           — File uploads (Cloudinary)
 *   /api/bulk/system-settings   — System settings
 */

const express    = require('express');
const cors       = require('cors');
const compression = require('compression');
const helmet     = require('helmet');
const pinoHttp   = require('pino-http');
const logger = require('./utils/logger');

const { errorHandler, notFound } = require('./middleware/errorHandler');

// ── Metabsp routes ────────────────────────────────────────────────────────────
const usersRouter    = require('./routes/Users');
const whatsappRouter = require('./routes/WhatsAppCloud');
const webhookRouter  = require('./routes/webhook');
const webhookDestinationsRouter = require('./routes/webhookDestinations');

// ── Bulk-invite routes ────────────────────────────────────────────────────────
const bulkCrudRoutes = require('../bulk/routes/crudRoutes');

const app = express();

app.use(helmet());
app.use(
  pinoHttp({
    logger: logger.raw,
    autoLogging: {
      ignore: (req) => req.url === '/health' || req.url === '/',
    },
  })
);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://bulk-invite-frontend.vercel.app',
  'https://bulk.instify.in',
  'https://bkfrontend.vercel.app',
  'https://bkawards.instify.in',
  'https://meta.sanjusk.in',
  'https://meta.instify.in',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin '${origin}' not allowed`), false);
  },
  credentials: true,
}));

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(compression());

// Health check
app.get('/', (_req, res) => {
  res.status(200).json({ ok: true, service: 'Metabsp Unified Backend (WhatsApp Cloud + Bulk Invite)' });
});

app.get('/health', async (_req, res) => {
  try {
    const mongoose = require('mongoose');
    const state = mongoose.connection.readyState; // 1 = connected
    const payload = {
      ok: state === 1,
      db: state === 1 ? 'connected' : 'disconnected',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
    res.status(state === 1 ? 200 : 503).json(payload);
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// External REST API (API-key authenticated — no JWT required)
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/v1', require('./routes/externalApi'));

// ─────────────────────────────────────────────────────────────────────────────
// Metabsp (WhatsApp Cloud) routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/users',              usersRouter);
app.use('/api/whatsapp',           whatsappRouter);
app.use('/webhook',                webhookRouter);
app.use('/api/whatsapp/webhook',   webhookRouter);
app.use('/api/whatsapp/webhook-destinations', webhookDestinationsRouter);

// ─────────────────────────────────────────────────────────────────────────────
// Bulk-invite (WhatsApp Automation / Baileys) routes — mounted under /api/bulk/
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/bulk/auth',               require('../bulk/routes/authRoutes'));
app.use('/api/bulk/org',                require('../bulk/routes/orgRoutes'));
app.use('/api/bulk/dashboard',          require('../bulk/routes/dashboardRoutes'));
app.use('/api/bulk/roles',              bulkCrudRoutes(require('../bulk/models/Role')));
app.use('/api/bulk/users',              require('../bulk/routes/userRoutes'));
app.use('/api/bulk/notifications',      bulkCrudRoutes(require('../bulk/models/Notification')));
app.use('/api/bulk/whatsapp',           require('../bulk/routes/whatsappRoutes'));
app.use('/api/bulk/baileys',            require('../bulk/routes/baileysRoutes'));
app.use('/api/bulk/blasts',             require('../bulk/routes/blastRoutes'));
app.use('/api/bulk/campaigns',          require('../bulk/routes/campaignRoutes'));
app.use('/api/bulk/uploads',            require('../bulk/routes/uploadRoutes'));
app.use('/api/bulk/system-settings',    require('../bulk/routes/systemSettingsRoutes'));

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;

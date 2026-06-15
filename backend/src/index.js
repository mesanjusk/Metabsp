/**
 * Unified Metabsp + Bulk-invite backend entry point.
 *
 * Metabsp (WhatsApp Cloud BSP) routes are mounted at their original paths:
 *   /api/users         — WhatsApp Cloud user management
 *   /api/whatsapp      — WhatsApp Cloud API
 *   /webhook           — Meta webhook
 *   /api/whatsapp/webhook — Meta webhook (alternate)
 *
 * Bulk-invite (Event Management / Baileys) routes are mounted under /api/bulk/:
 *   /api/bulk/auth              — Bulk-invite auth (login, me)
 *   /api/bulk/org               — Organisation
 *   /api/bulk/dashboard         — Dashboard stats
 *   /api/bulk/roles             — Roles (CRUD)
 *   /api/bulk/users             — Bulk-invite user management
 *   /api/bulk/events            — Events (CRUD)
 *   /api/bulk/categories        — Categories (CRUD)
 *   /api/bulk/students          — Students
 *   /api/bulk/stage-assignments — Stage assignments
 *   /api/bulk/notifications     — Notifications (CRUD)
 *   /api/bulk/donations         — Donations (CRUD)
 *   /api/bulk/automation-rules  — Automation rules (CRUD)
 *   /api/bulk/certificate-templates — Certificate templates (CRUD)
 *   /api/bulk/teams             — Teams (CRUD)
 *   /api/bulk/budget-heads      — Budget heads (CRUD)
 *   /api/bulk/vendors           — Vendors (CRUD)
 *   /api/bulk/expenses          — Expenses (CRUD)
 *   /api/bulk/event-tasks       — Event tasks (CRUD)
 *   /api/bulk/whatsapp          — Baileys WhatsApp (templates, etc.)
 *   /api/bulk/baileys           — Baileys QR/session control
 *   /api/bulk/blasts            — WhatsApp blast messages
 *   /api/bulk/uploads           — File uploads (Cloudinary)
 *   /api/bulk/volunteers        — Volunteers
 *   /api/bulk/system-settings   — System settings
 *   /api/bulk/anchors           — Anchors
 */

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const compression = require('compression');

// ── Metabsp dependencies ──────────────────────────────────────────────────────
const connectDB        = require('./config/mongo');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { initSocket }   = require('./socket');

// ── Bulk-invite dependencies ──────────────────────────────────────────────────
const bulkConnectDB   = require('../bulk/config/db');
const { setIO }       = require('../bulk/services/socket');
const seedAdmin       = require('../bulk/seedAdmin');

// ── Metabsp routes ────────────────────────────────────────────────────────────
const usersRouter    = require('./routes/Users');
const whatsappRouter = require('./routes/WhatsAppCloud');
const webhookRouter  = require('./routes/webhook');

// ── Bulk-invite routes ────────────────────────────────────────────────────────
const bulkCrudRoutes = require('../bulk/routes/crudRoutes');

// ─────────────────────────────────────────────────────────────────────────────
// Process error guards (merged from both servers)
// ─────────────────────────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  const msg = reason?.message || String(reason);
  if (msg.includes('Connection Closed') || msg.includes('Timed Out') || msg.includes('baileys')) {
    console.warn('[unhandledRejection] Baileys internal error (ignored):', msg);
  } else {
    console.error('[unhandledRejection]', reason);
  }
});

process.on('uncaughtException', (err) => {
  const msg = err?.message || String(err);
  if (msg.includes('Connection Closed') || msg.includes('Timed Out')) {
    console.warn('[uncaughtException] Baileys socket error (ignored):', msg);
  } else {
    console.error('[uncaughtException] Fatal:', err);
    process.exit(1);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Express app
// ─────────────────────────────────────────────────────────────────────────────
const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://bulk-invite-frontend.vercel.app',
  'https://bulk.instify.in',
  'https://bkfrontend.vercel.app',
  'https://bkawards.instify.in',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, true); // allow all in dev; tighten in production
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

// ─────────────────────────────────────────────────────────────────────────────
// Metabsp (WhatsApp Cloud) routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/users',              usersRouter);
app.use('/api/whatsapp',           whatsappRouter);
app.use('/webhook',                webhookRouter);
app.use('/api/whatsapp/webhook',   webhookRouter);

// ─────────────────────────────────────────────────────────────────────────────
// Bulk-invite (Event Management / Baileys) routes — mounted under /api/bulk/
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/bulk/auth',               require('../bulk/routes/authRoutes'));
app.use('/api/bulk/org',                require('../bulk/routes/orgRoutes'));
app.use('/api/bulk/dashboard',          require('../bulk/routes/dashboardRoutes'));
app.use('/api/bulk/roles',              bulkCrudRoutes(require('../bulk/models/Role')));
app.use('/api/bulk/users',              require('../bulk/routes/userRoutes'));
app.use('/api/bulk/events',             bulkCrudRoutes(require('../bulk/models/Event')));
app.use('/api/bulk/categories',         bulkCrudRoutes(require('../bulk/models/Category'), 'anchorId backupAnchorIds preferredGuestIds'));
app.use('/api/bulk/students',           require('../bulk/routes/studentRoutes'));
app.use('/api/bulk/stage-assignments',  require('../bulk/routes/stageRoutes'));
app.use('/api/bulk/notifications',      bulkCrudRoutes(require('../bulk/models/Notification')));
app.use('/api/bulk/donations',          bulkCrudRoutes(require('../bulk/models/Donation'), 'donorGuestId receivedByUserId'));
app.use('/api/bulk/automation-rules',   bulkCrudRoutes(require('../bulk/models/AutomationRule')));
app.use('/api/bulk/certificate-templates', bulkCrudRoutes(require('../bulk/models/CertificateTemplate')));
app.use('/api/bulk/teams',              bulkCrudRoutes(require('../bulk/models/Team'), 'leadUserId memberUserIds'));
app.use('/api/bulk/budget-heads',       bulkCrudRoutes(require('../bulk/models/BudgetHead'), 'responsibleTeamId responsibleUserId'));
app.use('/api/bulk/vendors',            bulkCrudRoutes(require('../bulk/models/Vendor'), 'budgetHeadId responsibleTeamId responsibleUserId'));
app.use('/api/bulk/expenses',           bulkCrudRoutes(require('../bulk/models/Expense'), 'budgetHeadId vendorId paidByUserId approvedByUserId'));
app.use('/api/bulk/event-tasks',        bulkCrudRoutes(require('../bulk/models/EventTask'), 'teamId assignedToUserId backupUserId linkedVendorId'));
app.use('/api/bulk/whatsapp',           require('../bulk/routes/whatsappRoutes'));
app.use('/api/bulk/baileys',            require('../bulk/routes/baileysRoutes'));
app.use('/api/bulk/blasts',             require('../bulk/routes/blastRoutes'));
app.use('/api/bulk/uploads',            require('../bulk/routes/uploadRoutes'));
app.use('/api/bulk/volunteers',         require('../bulk/routes/volunteerRoutes'));
app.use('/api/bulk/system-settings',    require('../bulk/routes/systemSettingsRoutes'));
app.use('/api/bulk/anchors',            require('../bulk/routes/anchors.routes'));

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────────────────────
async function startServer() {
  try {
    // Connect to MongoDB (both configs point to the same or separate Mongo URIs
    // via environment variables MONGO_URI / MONGO_URI_BULK or a shared one).
    await connectDB();

    // Connect bulk DB (uses MONGO_URI env var — same as above if shared)
    await bulkConnectDB();

    // Seed the bulk-invite super-admin if it doesn't exist yet
    await seedAdmin();

    const server = http.createServer(app);

    // Initialise a single Socket.IO server for both feature sets.
    // Metabsp's initSocket() creates the io instance internally; we capture it
    // here and also pass it to bulk's setIO() so both use the same connection.
    const io = initSocket(server);

    // Share the same io instance with the bulk-invite socket service
    setIO(io);

    // Extend the existing io with bulk-invite room logic
    io.on('connection', (socket) => {
      // join-role-room is used by bulk-invite real-time events
      socket.on('join-role-room', (role) => socket.join(`role:${role}`));
    });

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Unified server running on port ${PORT}`);

      // Auto-reconnect Baileys if saved credentials exist in MongoDB
      const { autoConnectIfCredentialsExist } = require('../bulk/services/baileysService');
      autoConnectIfCredentialsExist().catch((err) =>
        console.error('[baileys] Auto-connect failed on boot:', err.message)
      );
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();

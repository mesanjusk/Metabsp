/**
 * Process bootstrap: connects Mongo, seeds admin data, starts Socket.IO and
 * the HTTP server. Express route/middleware wiring lives in ./app.js so it
 * can be imported by tests without triggering any of this.
 */

require('dotenv').config();
const http = require('http');
const logger = require('./utils/logger');

const app = require('./app');
const connectDB = require('./config/mongo');
const { initSocket } = require('./socket');

const bulkConnectDB = require('../bulk/config/db');
const { setIO } = require('../bulk/services/socket');
const seedAdmin = require('../bulk/seedAdmin');
const { startTokenRefreshScheduler } = require('./services/tokenRefreshService');
const { startWhatsAppSendWorker } = require('./queues/whatsappSendWorker');
const { startInvoiceScheduler } = require('./services/invoiceSchedulerService');
const { startBackupScheduler } = require('./services/backupSchedulerService');
const { startRenderKeepAlive } = require('./services/renderKeepAliveService');
const { runPreflightOnBoot } = require('./services/preflightCheckService');

// ─────────────────────────────────────────────────────────────────────────────
// Process error guards (merged from both servers)
// ─────────────────────────────────────────────────────────────────────────────
// These previously swallowed socket errors from the unofficial WhatsApp Web
// client, which failed constantly and noisily. With only the Cloud API left,
// a "Connection Closed" is a real HTTP failure worth seeing, so nothing is
// suppressed any more.
process.on('unhandledRejection', (reason) => {
  logger.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('[uncaughtException] Fatal:', err);
  process.exit(1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────────────────────
async function startServer() {
  try {
    // Fail fast if the unified JWT secret isn't configured — every login (both
    // former "Metabsp" and "Bulk-invite" flows now share one auth path) depends on it.
    require('../bulk/utils/jwtSecret').getJwtSecret();

    // Connect to MongoDB (both configs point to the same or separate Mongo URIs
    // via environment variables MONGO_URI / MONGO_URI_BULK or a shared one).
    await connectDB();

    // Assert the shared connection bulk relies on is actually up (see
    // bulk/config/db.js — it no longer opens a second connection).
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

    // Periodically re-exchange WhatsApp Cloud access tokens nearing expiry
    // for fresh long-lived ones (see src/services/tokenRefreshService.js).
    startTokenRefreshScheduler();

    // Processes queued broadcast sends (see src/queues/). Runs in-process
    // rather than as a separate worker deployment for now — fine at current
    // scale, and can be split into its own process later without changing
    // the queue/job contract at all.
    startWhatsAppSendWorker();

    // Generates usage-metered invoices for subscriptions whose billing
    // period has ended (see src/services/invoiceSchedulerService.js).
    startInvoiceScheduler();

    // Optional, off by default (see src/services/backupSchedulerService.js
    // and docs/BACKUP_RESTORE.md) — set ENABLE_SCHEDULED_BACKUPS=true and
    // BACKUP_DIR to a real, persistent (ideally off-host) mount to enable.
    startBackupScheduler();

    // Pings the sibling Render services every 10 minutes so none of them
    // spin down on Render's free tier (see renderKeepAliveService.js).
    // Redundant with .github/workflows/render-keep-alive.yml — set
    // ENABLE_RENDER_KEEP_ALIVE=false to disable.
    startRenderKeepAlive();

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      logger.info(`🚀 Unified server running on port ${PORT}`);

      // Read-only audit of the Meta-side configuration whose failure mode is
      // silence rather than an error — most importantly, coexistence being
      // enabled while its webhook fields are unsubscribed (see
      // services/preflightCheckService.js and
      // docs/meta-tech-provider/COEXISTENCE.md). One Graph call, fired after
      // the port is already open so it can never delay or block a boot; set
      // RUN_PREFLIGHT_ON_BOOT=false to skip it.
      runPreflightOnBoot().catch((err) =>
        logger.error('[preflight] Boot check failed (non-fatal):', err.message)
      );

    });

    const shutdown = (signal) => {
      logger.info(`[server] ${signal} received — shutting down gracefully`);
      server.close(() => {
        const mongoose = require('mongoose');
        mongoose.connection.close(false, () => process.exit(0));
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();

/**
 * Baileys WhatsApp service — per-user/tenant sessions.
 *
 * Each user gets their own isolated WhatsApp socket, auth state, and QR code.
 * Sessions are keyed by a userId string. Callers that do not pass a userId
 * fall back to the '_global_' session, preserving backward compatibility with
 * the bulk-app controllers.
 *
 * FIX for code=405: fetchLatestBaileysVersion is a NAMED export from Baileys,
 * not a property of the default export. Must be destructured from the raw module.
 */

const { emitEvent } = require('./socket');
const { useMongoAuthState, clearMongoAuthState, listSavedUserIds } = require('./baileysAuthState');

const MAX_RECONNECT_ATTEMPTS = 5;
const DEFAULT_USER = '_global_';

// Map<userId, SessionState>
const sessions = new Map();

function getSession(userId = DEFAULT_USER) {
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      socket:         null,
      state:          { qr: null, status: 'DISCONNECTED', phone: '' },
      reconnectTimer: null,
      isConnecting:   false,
      reconnectCount: 0,
    });
  }
  return sessions.get(userId);
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function getWASocketAndVersion() {
  const mod = await import('@whiskeysockets/baileys');

  const makeWASocket = mod.default?.makeWASocket
    ?? mod.makeWASocket
    ?? mod.default
    ?? mod;

  const fetchLatestBaileysVersion = mod.fetchLatestBaileysVersion
    ?? mod.default?.fetchLatestBaileysVersion;

  let version = [2, 3000, 1023024415];

  if (typeof fetchLatestBaileysVersion === 'function') {
    try {
      const result = await Promise.race([
        fetchLatestBaileysVersion(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10_000)),
      ]);
      if (Array.isArray(result?.version) && result.version.length === 3) {
        version = result.version;
        console.log('[baileys] live WA version:', version.join('.'));
      }
    } catch (e) {
      console.warn('[baileys] version fetch error:', e.message, '— using fallback');
    }
  } else {
    console.warn('[baileys] fetchLatestBaileysVersion not found — using fallback');
    console.log('[baileys] module keys:', Object.keys(mod).join(', '));
  }

  return { makeWASocket, version };
}

async function toQrDataUrl(raw) {
  try {
    const qrcode = (await import('qrcode')).default;
    return await qrcode.toDataURL(raw, { width: 300 });
  } catch {
    return raw;
  }
}

function formatJid(phone) {
  const str = String(phone || '');
  if (str.includes('@')) return str;
  const clean = str.replace(/\D/g, '');
  return `${clean}@s.whatsapp.net`;
}

function normalizeBaileysMessage(msg) {
  const from = (msg.key.remoteJid || '').split('@')[0];
  const body =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption || '';
  return {
    id: msg.key.id, from, body,
    type: msg.message?.imageMessage ? 'image' : 'text',
    timestamp: msg.messageTimestamp,
    raw: msg,
  };
}

function killSocket(session) {
  if (session.socket) {
    try { session.socket.end(undefined); } catch (_) {}
    session.socket = null;
  }
}

// ── public API ────────────────────────────────────────────────────────────────

function getStatus(userId = DEFAULT_USER) {
  return { ...getSession(userId).state };
}

async function connect(userId = DEFAULT_USER) {
  const session = getSession(userId);
  const tag = `[baileys:${userId}]`;

  if (session.isConnecting) {
    console.log(`${tag} resetting stuck isConnecting flag...`);
    session.isConnecting = false;
  }
  session.isConnecting = true;
  console.log(`${tag} connect() called — starting Baileys socket...`);

  if (session.reconnectTimer) { clearTimeout(session.reconnectTimer); session.reconnectTimer = null; }
  killSocket(session);

  try {
    const { makeWASocket, version } = await getWASocketAndVersion();
    const pino   = (await import('pino')).default;
    const logger = pino({ level: 'silent' });

    const { state, saveCreds } = await useMongoAuthState(userId);

    const sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: { creds: state.creds, keys: state.keys },
      browser: ['MetaBSP', 'Chrome', '120.0.0'],
      generateHighQualityLinkPreview: false,
      syncFullHistory:                false,
      markOnlineOnConnect:            false,
      connectTimeoutMs:    60_000,
      keepAliveIntervalMs: 25_000,
      retryRequestDelayMs: 500,
    });

    session.socket = sock;

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`${tag} QR received`);
        const qrDataUrl = await toQrDataUrl(qr);
        session.state = { qr: qrDataUrl, status: 'QR_PENDING', phone: '' };
        emitEvent('baileys_status', { userId, ...session.state });
      }

      if (connection === 'open') {
        const phone = sock.user?.id?.split(':')[0] || sock.user?.id || '';
        session.state = { qr: null, status: 'CONNECTED', phone };
        emitEvent('baileys_status', { userId, ...session.state });
        console.log(`${tag} connected as +${phone}`);
        session.isConnecting   = false;
        session.reconnectCount = 0;
      }

      if (connection === 'close') {
        const code      = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === 401;
        console.log(`${tag} disconnected code=${code}`);

        session.state  = { qr: null, status: 'DISCONNECTED', phone: '' };
        session.socket = null;
        session.isConnecting = false;
        emitEvent('baileys_status', { userId, ...session.state });

        if (loggedOut || code === 405 || code === 440) {
          if (code !== 440) await clearMongoAuthState(userId).catch(console.error);
          session.reconnectCount = 0;
          if (code === 440) {
            console.log(`${tag} code=440 — another session took over. Remove old Linked Device then reconnect.`);
          } else {
            console.log(`${tag} code=${code} — credentials cleared. Click Connect for a fresh QR.`);
          }
        } else {
          session.reconnectCount++;
          if (session.reconnectCount <= MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(5000 * session.reconnectCount, 25000);
            console.log(`${tag} reconnecting in ${delay}ms (attempt ${session.reconnectCount}/${MAX_RECONNECT_ATTEMPTS})…`);
            session.reconnectTimer = setTimeout(() => connect(userId).catch(console.error), delay);
          } else {
            console.log(`${tag} max reconnect attempts reached. Manual reconnect required.`);
            session.reconnectCount = 0;
          }
        }
      }
    });

    sock.ev.on('creds.update', () => saveCreds().catch(console.error));

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (!msg.key.fromMe) {
          emitEvent('baileys_incoming_message', { userId, ...normalizeBaileysMessage(msg) });
        }
      }
    });

  } catch (err) {
    session.isConnecting = false;
    console.error(`${tag} connect() error:`, err.message);
    session.state = { qr: null, status: 'DISCONNECTED', phone: '' };
    emitEvent('baileys_status', { userId, ...session.state });
    throw err;
  }
}

async function disconnect(userId = DEFAULT_USER) {
  const session = getSession(userId);
  session.reconnectCount = 0;
  if (session.reconnectTimer) { clearTimeout(session.reconnectTimer); session.reconnectTimer = null; }
  killSocket(session);
  await clearMongoAuthState(userId).catch(console.error);
  session.state = { qr: null, status: 'DISCONNECTED', phone: '' };
  session.isConnecting = false;
  emitEvent('baileys_status', { userId, ...session.state });
  console.log(`[baileys:${userId}] disconnected and credentials cleared.`);
}

async function sendText(userIdOrOpts, optsOrUndefined) {
  // Supports both: sendText(userId, { to, body }) and legacy sendText({ to, body })
  let userId, opts;
  if (typeof userIdOrOpts === 'string') {
    userId = userIdOrOpts;
    opts   = optsOrUndefined;
  } else {
    userId = DEFAULT_USER;
    opts   = userIdOrOpts;
  }
  if (!opts || typeof opts !== 'object') throw new Error('sendText: { to, body } options are required');
  const { to, body } = opts;
  const session = getSession(userId);
  if (!session.socket || session.state.status !== 'CONNECTED')
    throw new Error('Baileys not connected — scan QR first.');
  return session.socket.sendMessage(formatJid(to), { text: body });
}

async function sendImage(userIdOrOpts, optsOrUndefined) {
  let userId, opts;
  if (typeof userIdOrOpts === 'string') {
    userId = userIdOrOpts;
    opts   = optsOrUndefined;
  } else {
    userId = DEFAULT_USER;
    opts   = userIdOrOpts;
  }
  if (!opts || typeof opts !== 'object') throw new Error('sendImage: { to, imageUrl } options are required');
  const { to, imageUrl, caption = '' } = opts;
  const session = getSession(userId);
  if (!session.socket || session.state.status !== 'CONNECTED')
    throw new Error('Baileys not connected — scan QR first.');
  return session.socket.sendMessage(formatJid(to), { image: { url: imageUrl }, caption });
}

async function sendButtonMessage(userIdOrOpts, optsOrUndefined) {
  let userId, opts;
  if (typeof userIdOrOpts === 'string') {
    userId = userIdOrOpts;
    opts   = optsOrUndefined;
  } else {
    userId = DEFAULT_USER;
    opts   = userIdOrOpts;
  }
  const { to, text, footer = '', buttons = [] } = opts;
  const session = getSession(userId);
  if (!session.socket || session.state.status !== 'CONNECTED')
    throw new Error('Baileys not connected — scan QR first.');

  const pollName   = String(text || 'Please vote 🗳️').slice(0, 255);
  const pollValues = buttons.map(b => String(b.label || '').slice(0, 100)).filter(Boolean);
  if (!pollValues.length) throw new Error('Poll requires at least one option');

  const jid = formatJid(to);

  try {
    return await session.socket.sendMessage(jid, {
      poll: { name: pollName, values: pollValues, selectableCount: 1 },
    });
  } catch (_) {}

  try {
    return await session.socket.sendMessage(jid, {
      listMessage: {
        title: pollName, text: pollName, footerText: '', buttonText: '🗳️ Respond', listType: 1,
        sections: [{
          title: 'Your Response',
          rows: pollValues.map((label, i) => ({ title: label, rowId: `rsvp_${i}`, description: '' })),
        }],
      },
    });
  } catch (_) {}

  const numbered = pollValues.map((v, i) => `${i + 1}. ${v}`).join('\n');
  return session.socket.sendMessage(jid, {
    text: `🗳️ *${pollName}*\n\n${numbered}\n\n_Reply with your choice number._`,
  });
}

async function getGroups(userId = DEFAULT_USER) {
  const session = getSession(userId);
  if (!session.socket || session.state.status !== 'CONNECTED') return [];
  try {
    const groups = await session.socket.groupFetchAllParticipating();
    return Object.entries(groups).map(([id, meta]) => ({ id, name: meta.subject || '' }));
  } catch (e) {
    console.error(`[baileys:${userId}] getGroups error:`, e.message);
    return [];
  }
}

async function autoConnectIfCredentialsExist(userId) {
  if (userId) {
    // Reconnect a specific user
    try {
      const { state } = await useMongoAuthState(userId);
      if (state?.creds?.me || state?.creds?.noiseKey) {
        console.log(`[baileys:${userId}] Saved credentials found — auto-connecting…`);
        await connect(userId);
      }
    } catch (err) {
      console.error(`[baileys:${userId}] autoConnect error:`, err.message);
    }
  } else {
    // Reconnect all users with saved credentials
    try {
      const userIds = await listSavedUserIds();
      if (!userIds.length) {
        console.log('[baileys] No saved credentials found — waiting for manual QR scan.');
        return;
      }
      console.log(`[baileys] Auto-connecting ${userIds.length} saved session(s)…`);
      for (const uid of userIds) {
        await connect(uid).catch(err => console.error(`[baileys:${uid}] autoConnect error:`, err.message));
      }
    } catch (err) {
      console.error('[baileys] autoConnectIfCredentialsExist error:', err.message);
    }
  }
}

module.exports = { connect, disconnect, sendText, sendImage, sendButtonMessage, getStatus, getGroups, autoConnectIfCredentialsExist };

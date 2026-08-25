const fs = require('fs');
const path = require('path');

// backend/src/services/coexistenceService.js and
// nextjs/lib/whatsapp/coexistence.ts are hand-maintained ports of each other,
// writing to the SAME MongoDB collections. Drift between them is silent and
// deployment-specific: a bug fixed on one host quietly persists on the other.
//
// This is a source-level contract test rather than a behavioural one, because
// the Next.js app has no test runner of its own. It deliberately asserts only
// the cross-cutting contract — payload keys read, DB paths written, message
// provenance, and the side effects that must exist on both sides — so ordinary
// refactors do not trip it but a dropped feature does.
//
// It exists because exactly one such drift was already found: the Next.js port
// never forwarded `smb_message_echoes` to webhook destinations, so a sibling
// bot on a Vercel deployment could not tell that a human had already answered
// from the WhatsApp Business app.

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const backendSrc = fs.readFileSync(
  path.join(REPO_ROOT, 'backend/src/services/coexistenceService.js'),
  'utf8'
);
const nextSrc = fs.readFileSync(
  path.join(REPO_ROOT, 'nextjs/lib/whatsapp/coexistence.ts'),
  'utf8'
);

// Comments in both files explain at length what is deliberately NOT done
// (e.g. never touching `conversation.windowOpen`). Assertions about absence
// must therefore look at code only, or they match the explanation itself.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const IMPLEMENTATIONS = [
  ['backend', backendSrc],
  ['nextjs', nextSrc],
];

const CODE_ONLY = IMPLEMENTATIONS.map(([name, src]) => [name, stripComments(src)]);

describe('coexistence backend/nextjs parity', () => {
  // Webhook payload keys. If Meta renames one, both ports must be updated
  // together or the un-updated host silently stops importing that event type.
  it.each([
    'message_echoes',
    'state_sync',
    'history',
    'threads',
    'chunk_order',
    'progress',
    'phase',
    'business_account_id',
    'phone_number_id',
    'display_phone_number',
  ])('both read the `%s` payload key', (key) => {
    for (const [name, src] of IMPLEMENTATIONS) {
      expect([name, src.includes(key)]).toEqual([name, true]);
    }
  });

  it('both declare the same three coexistence webhook fields', () => {
    const extract = (src) => {
      const match = src.match(/COEXISTENCE_FIELDS\s*=\s*\[([^\]]*)\]/);
      return match[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean).sort();
    };
    const expected = ['history', 'smb_app_state_sync', 'smb_message_echoes'];
    expect(extract(backendSrc)).toEqual(expected);
    expect(extract(nextSrc)).toEqual(expected);
  });

  // Account state written back to Mongo. A path present on one side only means
  // the dashboard shows sync progress on one host and nothing on the other.
  it.each([
    'coexistence.enabled',
    'coexistence.historySyncStatus',
    'coexistence.historySyncProgress',
    'coexistence.historyChunksReceived',
    'coexistence.historyMessagesImported',
    'coexistence.lastHistorySyncAt',
    'coexistence.contactsSynced',
    'coexistence.lastStateSyncAt',
    'coexistence.lastEchoAt',
  ])('both write the `%s` account field', (field) => {
    for (const [name, src] of IMPLEMENTATIONS) {
      expect([name, src.includes(field)]).toEqual([name, true]);
    }
  });

  it('both tag message provenance identically', () => {
    for (const [name, src] of IMPLEMENTATIONS) {
      expect([name, src.includes("'coexistence_app'")]).toEqual([name, true]);
      expect([name, src.includes("'coexistence_history'")]).toEqual([name, true]);
      expect([name, src.includes('isHistorical')]).toEqual([name, true]);
    }
  });

  it('both forward echoes to webhook destinations as message.echo', () => {
    // The one drift this suite was written after: without this, a sibling bot
    // cannot tell that a human already replied from the Business app.
    for (const [name, src] of IMPLEMENTATIONS) {
      expect([name, src.includes('forwardToWebhookDestinations')]).toEqual([name, true]);
      expect([name, src.includes("'message.echo'")]).toEqual([name, true]);
    }
  });

  it('neither reopens the 24-hour window from coexistence traffic', () => {
    // Only a customer message opens Meta's customer service window. An echo is
    // business-initiated, and history is already-delivered past traffic.
    for (const [name, code] of CODE_ONLY) {
      expect([name, code.includes('windowOpen')]).toEqual([name, false]);
    }
  });

  it('neither issues an empty $set when upserting a contact', () => {
    // Mongo rejects `{$set: {}}`; a history thread with no new messages hits
    // exactly that path.
    for (const [name, src] of IMPLEMENTATIONS) {
      expect([name, src.includes('Object.keys(set).length')]).toEqual([name, true]);
    }
  });

  it('both record a contact removal instead of deleting it', () => {
    for (const [name, src] of IMPLEMENTATIONS) {
      expect([name, src.includes('coexistenceRemovedAt')]).toEqual([name, true]);
      expect([name, /Contact\.(deleteOne|deleteMany|findOneAndDelete)/.test(src)]).toEqual([name, false]);
    }
  });

  it('both process history before echoes so conversations stay chronological', () => {
    // Compare CALL order, not definition order — nextjs defines processEchoes
    // above processHistoryChunks but invokes them the other way round in
    // processCoexistenceEvents. The backend's ordering lives in receiveWebhook,
    // where the calls are prefixed with `coexistenceProcessor.`.
    const backendController = stripComments(
      fs.readFileSync(path.join(REPO_ROOT, 'backend/src/controllers/whatsappController.js'), 'utf8')
    );
    const nextOrchestrator = stripComments(nextSrc).slice(
      stripComments(nextSrc).indexOf('processCoexistenceEvents')
    );

    const callSites = [
      ['backend', backendController, 'coexistenceProcessor.processHistoryChunks', 'coexistenceProcessor.processEchoes'],
      ['nextjs', nextOrchestrator, 'await processHistoryChunks', 'await processEchoes'],
    ];

    for (const [name, src, historyCall, echoCall] of callSites) {
      const history = src.indexOf(historyCall);
      const echoes = src.indexOf(echoCall);
      expect([name, `history@${history >= 0}`, `echo@${echoes >= 0}`, history < echoes]).toEqual([
        name, 'history@true', 'echo@true', true,
      ]);
    }
  });
});

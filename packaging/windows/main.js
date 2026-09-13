'use strict';

const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const path = require('node:path');

/**
 * The Windows desktop shell.
 *
 * Deliberately thin: it loads the deployed web app rather than bundling a copy of it. Everything
 * about this product is server-rendered per request and authenticated against a live API, so a
 * bundled build would be a second deployment to keep in step with the first — and the moment it
 * fell behind, Windows users would be on a version nobody could reproduce. Loading the origin means
 * a Windows user is always on the same build as everyone else, and shipping a fix needs no new
 * installer.
 *
 * What the shell adds over a browser tab: its own window and taskbar identity, a real desktop and
 * Start-menu entry, no address bar, remembered window size, and links to anywhere else opening in
 * the user's actual browser instead of trapping them inside the app.
 *
 * Set SANJUSK_URL at build or run time to point a build at staging.
 */

const APP_URL = process.env.SANJUSK_URL || 'https://REPLACE_WITH_PRODUCTION_HOST';
const APP_ORIGIN = new URL(APP_URL).origin;

/** One instance. A second launch focuses the window that already exists. */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [existing] = BrowserWindow.getAllWindows();
    if (existing) {
      if (existing.isMinimized()) existing.restore();
      existing.focus();
    }
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: '#F1F3F7',
    title: 'SanjuSK',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      // The renderer loads a remote origin, so it gets no Node and no direct access to anything of
      // ours. contextIsolation plus sandbox is what keeps a compromise of the web app from becoming
      // a compromise of the user's machine — the default for any shell that loads remote content.
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Shown only once there is something to look at, rather than as a white rectangle while the app
  // loads.
  window.once('ready-to-show', () => window.show());

  window.loadURL(APP_URL);

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    // -3 is ERR_ABORTED, which a normal in-app navigation produces; it is not a failure.
    if (!isMainFrame || errorCode === -3) return;
    window.loadFile(path.join(__dirname, 'offline.html'));
    console.error(`[desktop] could not load ${validatedURL}: ${errorDescription} (${errorCode})`);
  });

  /**
   * Anything outside our origin opens in the user's browser.
   *
   * Meta's Embedded Signup and the OAuth redirects are the reason this is a rule rather than a
   * nicety: they run on facebook.com, expect a real browser session, and a user who signs in inside
   * an app window has signed in somewhere their browser cannot see.
   */
  const openExternally = (url) => {
    if (new URL(url).origin !== APP_ORIGIN) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  };

  window.webContents.setWindowOpenHandler(({ url }) => openExternally(url));

  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== APP_ORIGIN) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // No remote permission requests are expected from this app; denying them all is both simpler and
  // safer than enumerating which ones would be fine.
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));

  return window;
}

app.whenReady().then(() => {
  // The default menu is a browser's menu. The app keeps only what a desktop app needs, and the
  // accelerators people actually press.
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'File',
        submenu: [{ role: 'quit' }],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About SanjuSK',
            click: () =>
              dialog.showMessageBox({
                type: 'info',
                title: 'SanjuSK',
                message: `SanjuSK Business Suite ${app.getVersion()}`,
                detail: `Connected to ${APP_ORIGIN}`,
              }),
          },
        ],
      },
    ]),
  );

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

'use strict';

/**
 * Runs before the remote page, in an isolated world.
 *
 * Deliberately empty of bridges. The web app is a complete product on its own and needs nothing
 * from Electron; exposing an IPC surface it does not use would be pure attack surface on a window
 * that loads remote content. The one thing set is a marker the page could read if it ever wants to
 * behave differently when installed — a plain boolean, not a capability.
 */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('sanjuskDesktop', Object.freeze({ isDesktop: true }));

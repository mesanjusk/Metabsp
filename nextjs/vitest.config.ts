import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * The Express side had 43 test files; the Next.js port had none. This config
 * plus tests/ is where that safety net moves to, so consolidating onto one
 * stack does not mean shipping one without tests.
 *
 * Node environment, not jsdom: everything under test here is server-side —
 * route handlers, queue producers, crypto, the socket emitter's addressing.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',
    // The studio's tests travel with its code: they sit next to what they cover under lib/video,
    // the way they did in its own repository, so a port that breaks one fails this deploy gate
    // rather than arriving silently. 330-odd of them cover the queue, the provider routing, the
    // browser engine and the Google Flow adapters.
    include: ['tests/**/*.test.ts', 'lib/video/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Redis- and Mongo-backed modules are mocked per test; running serially
    // keeps module-level singletons (the Redis connection cached on `global`)
    // from being shared across files in surprising ways.
    fileParallelism: false,
    coverage: { provider: 'v8', reporter: ['text', 'lcov'], include: ['lib/**'] },
  },
});

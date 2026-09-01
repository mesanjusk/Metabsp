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
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Redis- and Mongo-backed modules are mocked per test; running serially
    // keeps module-level singletons (the Redis connection cached on `global`)
    // from being shared across files in surprising ways.
    fileParallelism: false,
    coverage: { provider: 'v8', reporter: ['text', 'lcov'], include: ['lib/**'] },
  },
});

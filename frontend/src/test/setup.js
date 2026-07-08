import '@testing-library/jest-dom';

// jsdom has no ResizeObserver, which recharts' ResponsiveContainer requires
// to measure its container — a no-op stub is the standard way to test
// recharts components under jsdom.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

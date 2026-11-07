import '@testing-library/jest-dom/vitest';
import './i18n';

// jsdom has no ResizeObserver; Radix's slider measures its thumb with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

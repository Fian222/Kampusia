import { afterEach, expect, test } from 'bun:test';
import { selectionPopover } from './selection-popover';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalObserver = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
afterEach(() => {
  for (const [key, descriptor] of [['window', originalWindow], ['ResizeObserver', originalObserver]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function popupFixture({ top = 368, bottom = 424, contentHeight = 194, viewportHeight = 480, offsetTop = 0 } = {}) {
  const listeners = new Map<string, () => void>();
  const addEventListener = (name: string, callback: () => void) => { listeners.set(name, callback); };
  const removeEventListener = (name: string) => { listeners.delete(name); };
  const viewportListeners = new Map<string, () => void>();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    innerWidth: 452, innerHeight: viewportHeight,
    addEventListener, removeEventListener,
    visualViewport: { height: viewportHeight, offsetTop,
      addEventListener: (name: string, callback: () => void) => { viewportListeners.set(name, callback); },
      removeEventListener: (name: string) => { viewportListeners.delete(name); },
    },
  } });
  let resized = () => {};
  let disconnected = false;
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: class {
    constructor(callback: () => void) { resized = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  } });
  let shown = false;
  const style = { top: '', left: '', width: '', maxHeight: '' };
  const node = {
    style,
    showPopover() { shown = true; }, hidePopover() { shown = false; },
    matches() { return shown; },
    getBoundingClientRect() { return { height: shown ? Math.min(contentHeight, Number.parseFloat(style.maxHeight) || contentHeight) : 0 }; },
  };
  const trigger = { getBoundingClientRect: () => ({ top, bottom, left: 77, width: 303 }) };
  const action = selectionPopover(node as unknown as HTMLElement, () => trigger as unknown as HTMLElement);
  return { style, action, listeners, viewportListeners,
    get height() { return node.getBoundingClientRect().height; },
    get shown() { return shown; }, get disconnected() { return disconnected; },
    resize(height: number) { contentHeight = height; resized(); },
  };
}

test('short dropdown opening above stays six pixels from its trigger', () => {
  const popup = popupFixture();
  expect(368 - (Number.parseFloat(popup.style.top) + popup.height)).toBe(6);
  popup.action.destroy();
});

test('short dropdown opens below when its actual content fits', () => {
  const popup = popupFixture({ top: 400, bottom: 444, contentHeight: 100, viewportHeight: 600 });
  expect(Number.parseFloat(popup.style.top) - 444).toBe(6);
  popup.action.destroy();
});

test('search results changing height keep an upward dropdown attached', () => {
  const popup = popupFixture();
  popup.resize(260);
  expect(368 - (Number.parseFloat(popup.style.top) + popup.height)).toBe(6);
  popup.resize(100);
  expect(368 - (Number.parseFloat(popup.style.top) + popup.height)).toBe(6);
  popup.action.destroy();
});

test('long dropdown stays bounded within a compact visual viewport', () => {
  const popup = popupFixture({ top: 240, bottom: 284, contentHeight: 600, viewportHeight: 300, offsetTop: 80 });
  const top = Number.parseFloat(popup.style.top);
  expect(top).toBeGreaterThanOrEqual(92);
  expect(top + popup.height).toBeLessThanOrEqual(368);
  expect(240 - (top + popup.height)).toBe(6);
  popup.action.destroy();
});

test('destroy removes positioning listeners, observer and the open popover', () => {
  const popup = popupFixture();
  popup.action.destroy();
  expect(popup.listeners.size).toBe(0);
  expect(popup.viewportListeners.size).toBe(0);
  expect(popup.disconnected).toBe(true);
  expect(popup.shown).toBe(false);
});

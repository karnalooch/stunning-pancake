/* eslint-env jest */

/**
 * Jest-only react-native-mmkv v4 boundary.
 *
 * Unit tests run in Node and cannot load Nitro's native TurboModule. Keep the
 * production adapter real while replacing only the native MMKV factory with a
 * small in-memory implementation that follows the v4 method names.
 */
const stores = new Map();

function resolveStore(config = {}) {
  const id = config.id || 'mmkv.default';
  let store = stores.get(id);
  if (!store) {
    store = new Map();
    stores.set(id, store);
  }
  return store;
}

const createMMKV = jest.fn((config = {}) => {
  const store = resolveStore(config);

  return {
    getString: jest.fn((key) => {
      const value = store.get(key);
      return typeof value === 'string' ? value : undefined;
    }),
    getNumber: jest.fn((key) => {
      const value = store.get(key);
      return typeof value === 'number' ? value : undefined;
    }),
    getBoolean: jest.fn((key) => {
      const value = store.get(key);
      return typeof value === 'boolean' ? value : undefined;
    }),
    getBuffer: jest.fn((key) => {
      const value = store.get(key);
      return value instanceof ArrayBuffer ? value : undefined;
    }),
    set: jest.fn((key, value) => {
      store.set(key, value);
    }),
    remove: jest.fn((key) => {
      store.delete(key);
    }),
    clearAll: jest.fn(() => {
      store.clear();
    }),
    getAllKeys: jest.fn(() => Array.from(store.keys())),
    contains: jest.fn((key) => store.has(key)),
  };
});

function __resetMMKVMock() {
  stores.clear();
  createMMKV.mockClear();
}

module.exports = {
  createMMKV,
  __resetMMKVMock,
};

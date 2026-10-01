import { strict as assert } from 'assert';
import { AppearanceStore, APPEARANCE_STORAGE_KEY } from '../packs/AppearanceStore';
import { BUILTIN_THEME_PACKS, roadbook } from '../packs/builtins';
import {
  contrastRatio, exportThemePack, MAX_CUSTOM_PACKS, MAX_PACK_CHARACTERS,
  parseThemePack, resolveColorMode, resolvePalette, ThemePackError,
} from '../packs/themePack';

function memory(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  let writes = 0;
  return { values, get writes() { return writes; },
    getString: (key: string) => values.get(key),
    set: (key: string, value: string) => { values.set(key, value); writes++; } };
}
const custom = (id = 'sunset') => JSON.stringify({ ...roadbook, id, name: 'Sunset' });
const preferences = { mode: 'dark' as const, highContrast: false };

describe('data-only theme packs', () => {
  for (const pack of BUILTIN_THEME_PACKS) {
    it(`${pack.id} round-trips and is deeply immutable`, () => {
      assert.deepEqual(parseThemePack(exportThemePack(pack)), pack);
      assert.ok(Object.isFrozen(pack) && Object.isFrozen(pack.light) && Object.isFrozen(pack.dark));
    });
  }
  for (const value of [null, [], {}, { ...roadbook, schemaVersion: 2 },
    { ...roadbook, id: '../unsafe' }, { ...roadbook, name: '<script>' },
    { ...roadbook, script: 'alert(1)' }, { ...roadbook, url: 'https://example.com' },
    { ...roadbook, light: { ...roadbook.light, action: 'url(https://example.com)' } },
    { ...roadbook, light: { ...roadbook.light, fontFamily: 'remote' } },
    { ...roadbook, dark: undefined }, { ...roadbook, name: '\u202Eevil' }]) {
    it(`rejects untrusted structure ${JSON.stringify(value).slice(0, 70)}`, () => {
      assert.throws(() => parseThemePack(JSON.stringify(value)), ThemePackError);
    });
  }
  it('rejects prototype keys without polluting Object', () => {
    const poisoned = custom().replace('"schemaVersion":1', '"schemaVersion":1,"__proto__":{"polluted":true}');
    assert.throws(() => parseThemePack(poisoned), ThemePackError);
    assert.equal(Object.prototype.hasOwnProperty.call({}, 'polluted'), false);
  });
  it('rejects malformed JSON and bounded oversized input', () => {
    assert.throws(() => parseThemePack('{'), ThemePackError);
    assert.throws(() => parseThemePack(' '.repeat(MAX_PACK_CHARACTERS + 1)), ThemePackError);
  });
  it('rejects invisible text, controls and error labels', () => {
    for (const key of ['text', 'muted', 'action', 'border', 'error'] as const) {
      assert.throws(() => parseThemePack(JSON.stringify({ ...roadbook,
        light: { ...roadbook.light, [key]: roadbook.light.surface } })), ThemePackError);
    }
  });
  it('computes black/white contrast without rounding a failing pair up', () => {
    assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
    assert.equal(contrastRatio('#FFFFFF', '#FFFFFF'), 1);
  });
  it('resolves system, manual and unavailable system modes', () => {
    assert.equal(resolveColorMode('system', 'dark'), 'dark');
    assert.equal(resolveColorMode('system', null), 'light');
    assert.equal(resolveColorMode('system', 'light'), 'light');
    assert.equal(resolveColorMode('light', 'dark'), 'light');
    assert.equal(resolveColorMode('dark', 'light'), 'dark');
  });
  it('high contrast overrides every pack and keeps normal text at least 7:1', () => {
    for (const pack of BUILTIN_THEME_PACKS) {
      for (const mode of ['light', 'dark'] as const) {
        const palette = resolvePalette(pack, mode, true);
        assert.ok(contrastRatio(palette.text, palette.surface) >= 7);
        assert.ok(contrastRatio(palette.muted, palette.raised) >= 7);
        assert.ok(contrastRatio(palette.onAction, palette.action) >= 7);
      }
    }
  });
});

describe('appearance persistence and transactions', () => {
  it('starts without writing and defaults to system mode', () => {
    const storage = memory();
    const store = new AppearanceStore(storage);
    assert.equal(store.getSnapshot().preferences.mode, 'system');
    assert.equal(storage.writes, 0);
    assert.equal(store.getSnapshot(), store.getSnapshot());
  });
  for (const [legacy, mode] of [['grandPrix', 'light'], ['grandPrixNight', 'dark']] as const) {
    it(`migrates ${legacy} without overwriting old storage`, () => {
      const storage = memory({ theme_mode: legacy });
      assert.equal(new AppearanceStore(storage).getSnapshot().preferences.mode, mode);
      assert.equal(storage.writes, 0);
    });
  }
  it('installs a third pack without screen knowledge and restores it offline', () => {
    const storage = memory();
    const store = new AppearanceStore(storage);
    store.installAndSelect(custom(), preferences);
    assert.equal(storage.writes, 1);
    const restarted = new AppearanceStore(storage);
    assert.equal(restarted.getSnapshot().preferences.themeId, 'sunset');
    assert.equal(restarted.getPack('sunset').name, 'Sunset');
    assert.equal(restarted.getSnapshot().preferences.mode, 'dark');
  });
  it('preview parsing cannot change selection or storage', () => {
    const storage = memory();
    const store = new AppearanceStore(storage);
    const before = store.getSnapshot();
    parseThemePack(custom());
    assert.equal(store.getSnapshot(), before);
    assert.equal(storage.writes, 0);
  });
  it('rejects duplicate builtin and custom IDs atomically', () => {
    const storage = memory();
    const store = new AppearanceStore(storage);
    assert.throws(() => store.installAndSelect(exportThemePack(roadbook), preferences), ThemePackError);
    store.installAndSelect(custom(), preferences);
    const before = store.getSnapshot();
    assert.throws(() => store.installAndSelect(custom(), preferences), ThemePackError);
    assert.equal(store.getSnapshot(), before);
    assert.equal(storage.writes, 1);
  });
  it('does not publish a change when storage write fails', () => {
    const store = new AppearanceStore({ getString: () => undefined, set: () => { throw new Error('disk'); } });
    const before = store.getSnapshot();
    let notifications = 0;
    store.subscribe(() => { notifications++; });
    assert.throws(() => store.installAndSelect(custom(), preferences), ThemePackError);
    assert.equal(store.getSnapshot(), before);
    assert.equal(notifications, 0);
  });
  it('removing the active custom pack selects the builtin in the same write', () => {
    const storage = memory();
    const store = new AppearanceStore(storage);
    store.installAndSelect(custom(), preferences);
    store.removePack('sunset');
    assert.equal(store.getSnapshot().preferences.themeId, 'roadbook');
    assert.equal(new AppearanceStore(storage).getSnapshot().customPacks.length, 0);
    assert.throws(() => store.removePack('roadbook'), ThemePackError);
  });
  it('enforces custom pack count without evicting existing packs', () => {
    const store = new AppearanceStore(memory());
    for (let i = 0; i < MAX_CUSTOM_PACKS; i++) store.installAndSelect(custom(`custom-${i}`), preferences);
    const before = store.getSnapshot();
    assert.throws(() => store.installAndSelect(custom('overflow'), preferences), ThemePackError);
    assert.equal(store.getSnapshot(), before);
  });
  it('recovers corrupt persistence without writing over evidence', () => {
    for (const raw of ['{', '{}', JSON.stringify({ schemaVersion: 1, preferences: {
      themeId: 'missing', mode: 'dark', highContrast: false }, customPacks: [] })]) {
      const storage = memory({ [APPEARANCE_STORAGE_KEY]: raw });
      const store = new AppearanceStore(storage);
      assert.equal(store.getSnapshot().preferences.themeId, 'roadbook');
      assert.equal(store.getSnapshot().recovered, true);
      assert.equal(storage.writes, 0);
    }
  });
  it('reports unavailable persistence and still allows in-session preferences', () => {
    const store = new AppearanceStore(null);
    store.setPreferences({ themeId: 'forest', mode: 'system', highContrast: true });
    assert.equal(store.getSnapshot().persistence, 'unavailable');
    assert.equal(store.getSnapshot().preferences.themeId, 'forest');
  });
  it('notifies subscribers once and unsubscribes cleanly', () => {
    const store = new AppearanceStore(memory());
    let notifications = 0;
    const unsubscribe = store.subscribe(() => { notifications++; });
    store.setPreferences({ themeId: 'forest', ...preferences });
    assert.equal(notifications, 1);
    unsubscribe();
    store.setPreferences({ themeId: 'roadbook', ...preferences });
    assert.equal(notifications, 1);
  });
  it('rejects unknown selected packs and invalid preference types', () => {
    const store = new AppearanceStore(memory());
    assert.throws(() => store.setPreferences({ themeId: 'missing', ...preferences }), ThemePackError);
    assert.throws(() => store.setPreferences({ themeId: 'roadbook', ...preferences,
      highContrast: 'false' } as never), ThemePackError);
  });
});

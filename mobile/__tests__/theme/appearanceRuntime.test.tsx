import React, { useEffect, useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Share, useColorScheme } from 'react-native';
import { AppearanceStore } from '../../src/theme/packs/AppearanceStore';
import { roadbook, forest } from '../../src/theme/packs/builtins';
import { ThemeProvider, useAppearance } from '../../src/theme/ThemeProvider';
import { AppearanceSettingsPanel } from '../../src/components/appearance/AppearanceSettingsPanel';
import { UnistylesRuntime } from '../../src/theme/unistyles';
import { grandPrixTheme } from '../../src/theme/grandPrix';
import { toRuntimeTheme } from '../../src/theme/runtimeTheme';
import { getSemanticColors } from '../../src/theme/semantic';

jest.mock('react-native', () => ({
  useColorScheme: jest.fn(() => 'light'),
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
  TextInput: 'TextInput', Switch: 'Switch',
  StyleSheet: { create: (styles: unknown) => styles },
  Alert: { alert: jest.fn() },
  Share: { share: jest.fn(() => Promise.resolve({ action: 'sharedAction' })) },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-unistyles', () => ({
  UnistylesRuntime: { updateTheme: jest.fn(), setTheme: jest.fn() },
}));
jest.mock('../../src/theme/appearanceStore', () => ({ getAppearanceStore: jest.fn() }));
jest.mock('../../src/services/BrandingService', () => ({ BrandingService: { getCurrent: () => null } }));
jest.mock('../../src/i18n/useI18n', () => ({ useI18n: () => ({ locale: 'pl' }) }));

function storage() {
  const values = new Map<string, string>();
  return { getString: (key: string) => values.get(key),
    set: jest.fn((key: string, value: string) => { values.set(key, value); }) };
}
let trees: TestRenderer.ReactTestRenderer[] = [];
function mount(content: React.ReactElement): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(content); });
  trees.push(tree);
  return tree;
}
function press(tree: TestRenderer.ReactTestRenderer, id: string) {
  act(() => { tree.root.findByProps({ testID: id }).props.onPress(); });
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useColorScheme).mockReturnValue('light');
});
afterEach(() => {
  act(() => { trees.forEach((tree) => tree.unmount()); });
  trees = [];
});

describe('appearance runtime and real picker interactions (mocked native boundary)', () => {
  test('switches packs, modes and contrast without remounting stateful application children', () => {
    const store = new AppearanceStore(storage());
    const mounted = jest.fn();
    const unmounted = jest.fn();
    const values: { mode: string; action: string; session: object }[] = [];
    function SessionProbe() {
      const appearance = useAppearance();
      const [session] = useState(() => ({ id: 'existing-session' }));
      useEffect(() => { mounted(); return () => { unmounted(); }; }, []);
      values.push({ mode: appearance.colorMode, action: appearance.palette.action, session });
      return null;
    }
    const tree = mount(<ThemeProvider store={store}><SessionProbe /></ThemeProvider>);
    const first = values.at(-1)?.session;
    act(() => { store.setPreferences({ themeId: 'forest', mode: 'dark', highContrast: false }); });
    expect(values.at(-1)?.action).toBe(forest.dark.action);
    expect(UnistylesRuntime.setTheme).toHaveBeenLastCalledWith('grandPrixNight');
    act(() => { store.setPreferences({ themeId: 'forest', mode: 'system', highContrast: true }); });
    expect(values.at(-1)?.mode).toBe('light');
    jest.mocked(useColorScheme).mockReturnValue('dark');
    act(() => { tree.update(<ThemeProvider store={store}><SessionProbe /></ThemeProvider>); });
    expect(values.at(-1)?.mode).toBe('dark');
    expect(values.at(-1)?.session).toBe(first);
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
  });

  test('preview and cancel leave persisted selection untouched', () => {
    const disk = storage();
    const store = new AppearanceStore(disk);
    const close = jest.fn();
    const tree = mount(<ThemeProvider store={store}><AppearanceSettingsPanel onClose={close} /></ThemeProvider>);
    press(tree, 'appearance-pack-forest');
    press(tree, 'appearance-mode-dark');
    expect(tree.root.findByProps({ testID: 'appearance-preview' }).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: forest.dark.canvas })]),
    );
    expect(store.getSnapshot().preferences.themeId).toBe('roadbook');
    expect(disk.set).not.toHaveBeenCalled();
    press(tree, 'appearance-cancel');
    expect(close).toHaveBeenCalledTimes(1);
    expect(disk.set).not.toHaveBeenCalled();
  });

  test('apply persists the selected pack, mode and high contrast together', () => {
    const disk = storage();
    const store = new AppearanceStore(disk);
    const tree = mount(<ThemeProvider store={store}><AppearanceSettingsPanel onClose={() => {}} /></ThemeProvider>);
    press(tree, 'appearance-pack-forest');
    press(tree, 'appearance-mode-dark');
    act(() => { tree.root.findByProps({ testID: 'appearance-high-contrast' }).props.onValueChange(true); });
    press(tree, 'appearance-apply');
    expect(new AppearanceStore(disk).getSnapshot().preferences).toEqual({
      themeId: 'forest', mode: 'dark', highContrast: true,
    });
    expect(disk.set).toHaveBeenCalledTimes(1);
  });

  test('invalid import shows a failure; valid third pack remains a preview until apply', () => {
    const disk = storage();
    const store = new AppearanceStore(disk);
    const tree = mount(<ThemeProvider store={store}><AppearanceSettingsPanel onClose={() => {}} /></ThemeProvider>);
    const edit = (json: string) => act(() => {
      tree.root.findByProps({ testID: 'appearance-import-json' }).props.onChangeText(json);
    });
    edit('{');
    press(tree, 'appearance-import-preview');
    expect(tree.root.findByProps({ testID: 'appearance-error' })).toBeDefined();
    expect(disk.set).not.toHaveBeenCalled();
    edit(JSON.stringify({ ...roadbook, id: 'club-theme', name: 'Club' }));
    press(tree, 'appearance-import-preview');
    expect(store.getSnapshot().customPacks).toHaveLength(0);
    expect(disk.set).not.toHaveBeenCalled();
    press(tree, 'appearance-apply');
    expect(store.getSnapshot().preferences.themeId).toBe('club-theme');
    expect(new AppearanceStore(disk).getPack('club-theme').name).toBe('Club');
    expect(disk.set).toHaveBeenCalledTimes(1);
  });

  test('storage failure keeps the previous active pack and reports the failure', () => {
    const disk = storage();
    disk.set.mockImplementation(() => { throw new Error('disk full'); });
    const store = new AppearanceStore(disk);
    const tree = mount(<ThemeProvider store={store}><AppearanceSettingsPanel onClose={() => {}} /></ThemeProvider>);
    press(tree, 'appearance-pack-forest');
    press(tree, 'appearance-apply');
    expect(store.getSnapshot().preferences.themeId).toBe('roadbook');
    expect(tree.root.findByProps({ testID: 'appearance-error' }).props.children).toContain('Nie zapisano');
  });

  test('exports validated JSON through the share boundary, not executable content', () => {
    const store = new AppearanceStore(storage());
    const tree = mount(<ThemeProvider store={store}><AppearanceSettingsPanel onClose={() => {}} /></ThemeProvider>);
    press(tree, 'appearance-export');
    expect(Share.share).toHaveBeenCalledWith({ title: 'roadbook.json', message: JSON.stringify(roadbook, null, 2) });
  });

  test('compatibility adapter does not mutate legacy palette and keeps status roles separate', () => {
    const original = JSON.stringify(grandPrixTheme);
    const adapted = toRuntimeTheme(grandPrixTheme, roadbook.dark);
    const semantic = getSemanticColors(adapted.colors);
    expect(JSON.stringify(grandPrixTheme)).toBe(original);
    expect(semantic.action.primary).toBe(roadbook.dark.action);
    expect(semantic.status.warning).toBe(roadbook.dark.warning);
    expect(semantic.ride.gpsLocked).toBe(roadbook.dark.success);
    expect(semantic.status.warning).not.toBe(semantic.action.primary);
  });
});

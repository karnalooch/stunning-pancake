import 'react-native-gesture-handler';
// ─── CRITICAL: Unistyles must be configured before ANY other import ──────────
// ES module `import` statements are hoisted. If configure() lives inline here,
// App's dependency tree (RetroInput, PixelText, etc.) resolves first and their
// module-level StyleSheet.create() calls fire BEFORE configure() — causing crash.
// Isolating configure() in its own file forces Metro to execute it first.
import './src/theme/unistylesSetup';

import { registerRootComponent } from 'expo';

import App from './App';
registerRootComponent(App);

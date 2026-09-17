import 'react-native-gesture-handler';
import './src/security/installRedaction';
// ─── CRITICAL: Unistyles must be configured before ANY other UI import ───────
// ES module dependencies are evaluated before App's dependency tree. Keep the
// privacy redaction bootstrap and Unistyles setup ahead of App imports so both
// contracts are active before services/screens initialise.
import './src/theme/unistylesSetup';

import { registerRootComponent } from 'expo';

import App from './App';
registerRootComponent(App);

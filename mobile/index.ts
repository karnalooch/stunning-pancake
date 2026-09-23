import 'react-native-gesture-handler';
import './src/security/installRedaction';
// ─── CRITICAL: Unistyles must be configured before ANY other UI import ───────
// ES module dependencies are evaluated before App's dependency tree. Keep the
// privacy redaction bootstrap and Unistyles setup ahead of App imports so both
// contracts are active before services/screens initialise.
import './src/theme/unistylesSetup';

import { registerRootComponent } from 'expo';

import App from './App';
import { runE2eGpsLostKeyHarnessIfEnabled } from './src/bootstrap/e2eGpsLostKeyHarness';
import { runE2eGpsBackgroundHarnessIfEnabled } from './src/bootstrap/e2eGpsBackgroundHarness';

// Runtime-proof harnesses must not depend on a React commit. A render-time
// failure elsewhere in AppContent would otherwise prevent a storage-only E2E
// proof from running at all. The harness is a no-op unless the DEV-only,
// production-blocked destructive confirmation token is present.
void runE2eGpsLostKeyHarnessIfEnabled().catch((error) => {
  console.warn('[E2E GPS LOST KEY] FAILED', error);
});

void runE2eGpsBackgroundHarnessIfEnabled().catch((error) => {
  console.warn('[E2E GPS BG] FAILED', error);
});

registerRootComponent(App);

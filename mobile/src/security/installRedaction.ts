import { installConsoleRedaction } from './redaction';

// Imported from mobile/index.ts before App.tsx so module-initialisation warnings and
// runtime console output are scrubbed before React/navigation/services start.
installConsoleRedaction();

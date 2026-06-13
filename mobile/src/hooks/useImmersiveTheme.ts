import { useCallback, useState } from 'react';
import {
  isImmersiveThemeEnabled,
  setImmersiveThemeEnabled,
} from '../services/ImmersiveThemeService';
import { trackEngagement } from '../services/EngagementAnalytics';

export function useImmersiveTheme() {
  const [enabled, setEnabled] = useState(() => isImmersiveThemeEnabled());

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      setImmersiveThemeEnabled(next);
      trackEngagement('immersive_toggle', { enabled: next });
      return next;
    });
  }, []);

  const set = useCallback((value: boolean) => {
    setImmersiveThemeEnabled(value);
    setEnabled(value);
  }, []);

  return { enabled, toggle, set };
}

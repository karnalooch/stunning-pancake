import { useCallback, useState } from 'react';
import {
  isImmersiveThemeEnabled,
  setImmersiveThemeEnabled,
} from '../services/ImmersiveThemeService';

export function useImmersiveTheme() {
  const [enabled, setEnabled] = useState(() => isImmersiveThemeEnabled());

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      setImmersiveThemeEnabled(next);
      return next;
    });
  }, []);

  const set = useCallback((value: boolean) => {
    setImmersiveThemeEnabled(value);
    setEnabled(value);
  }, []);

  return { enabled, toggle, set };
}

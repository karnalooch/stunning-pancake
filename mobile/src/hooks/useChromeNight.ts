import { useEffect } from 'react';
import { UnistylesRuntime } from 'react-native-unistyles';

/** Auto day/night chrome (DS §3, §8) — engagement screens follow local hour. */
export function useChromeNight() {
  useEffect(() => {
    const apply = () => {
      const hour = new Date().getHours();
      const night = hour >= 20 || hour < 6;
      try {
        UnistylesRuntime.setTheme(night ? 'grandPrixNight' : 'grandPrix');
      } catch {
        /* Unistyles not ready */
      }
    };
    apply();
    const id = setInterval(apply, 60_000);
    return () => clearInterval(id);
  }, []);
}

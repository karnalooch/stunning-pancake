import { useEffect } from 'react';

interface ModerationHotkeyHandlers {
  onApprove?: () => void;
  onReject?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  enabled?: boolean;
}

export function useModerationHotkeys({
  onApprove,
  onReject,
  onNext,
  onPrev,
  enabled = true,
}: ModerationHotkeyHandlers) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const key = e.key.toLowerCase();
      if (key === 'a' && onApprove) {
        e.preventDefault();
        onApprove();
      } else if (key === 'r' && onReject) {
        e.preventDefault();
        onReject();
      } else if (key === 'j' && onNext) {
        e.preventDefault();
        onNext();
      } else if (key === 'k' && onPrev) {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, onApprove, onReject, onNext, onPrev]);
}

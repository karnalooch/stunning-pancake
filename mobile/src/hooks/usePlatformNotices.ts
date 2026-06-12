import { useCallback, useEffect, useState } from 'react';
import { MMKV } from 'react-native-mmkv';
import type { PlatformNotice } from '../components/PlatformNoticeBanner';
import { NoticeService } from '../services/api';

const DISMISSED_KEY = 'platform_notice_dismissed_ids';

function getDismissedIds(): Set<number> {
  try {
    const store = new MMKV();
    const raw = store.getString(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as number[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveDismissedIds(ids: Set<number>) {
  try {
    const store = new MMKV();
    store.set(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function usePlatformNotices(tenantId?: string | null) {
  const [notice, setNotice] = useState<PlatformNotice | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(() => getDismissedIds());

  const refresh = useCallback(async () => {
    try {
      const notices = await NoticeService.getActive(tenantId ?? undefined);
      const dismissedIds = getDismissedIds();
      const next = notices.find((n) => !dismissedIds.has(n.id)) ?? null;
      setNotice(next);
    } catch {
      setNotice(null);
    }
  }, [tenantId]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const dismiss = useCallback(
    (id: number) => {
      const next = new Set(dismissed);
      next.add(id);
      setDismissed(next);
      saveDismissedIds(next);
      setNotice(null);
      void refresh();
    },
    [dismissed, refresh],
  );

  return { notice, dismiss, refresh };
}

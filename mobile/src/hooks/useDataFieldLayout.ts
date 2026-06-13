import { useCallback, useMemo, useState } from 'react';
import type { DataFieldId } from '../ride/dataFields';
import {
  createDefaultStoredLayouts,
  getActiveLayout,
  loadStoredLayouts,
  saveStoredLayouts,
} from '../ride/layouts';
import type { DataFieldLayout, RideProfileId, StoredDataFieldLayouts } from '../ride/types';

export function useDataFieldLayout() {
  const [stored, setStored] = useState<StoredDataFieldLayouts>(() => loadStoredLayouts());

  const layout = useMemo(() => getActiveLayout(stored), [stored]);

  const setActiveProfile = useCallback((profileId: RideProfileId) => {
    setStored((prev) => {
      const next: StoredDataFieldLayouts = { ...prev, activeProfile: profileId };
      saveStoredLayouts(next);
      return next;
    });
  }, []);

  const updateSlotField = useCallback((slotKey: string, fieldId: DataFieldId) => {
    setStored((prev) => {
      const profileId = prev.activeProfile;
      const current = prev.profiles[profileId];
      if (!current) return prev;
      const slots = current.slots.map((slot) =>
        slot.slotKey === slotKey ? { ...slot, fieldId } : slot,
      );
      const nextLayout: DataFieldLayout = { ...current, slots };
      const next: StoredDataFieldLayouts = {
        ...prev,
        profiles: { ...prev.profiles, [profileId]: nextLayout },
      };
      saveStoredLayouts(next);
      return next;
    });
  }, []);

  const resetProfileLayout = useCallback((profileId: RideProfileId) => {
    setStored((prev) => {
      const defaults = createDefaultStoredLayouts();
      const next: StoredDataFieldLayouts = {
        ...prev,
        profiles: { ...prev.profiles, [profileId]: defaults.profiles[profileId] },
      };
      saveStoredLayouts(next);
      return next;
    });
  }, []);

  const swapSlots = useCallback((slotKeyA: string, slotKeyB: string) => {
    if (slotKeyA === slotKeyB) return;
    setStored((prev) => {
      const profileId = prev.activeProfile;
      const current = prev.profiles[profileId];
      if (!current) return prev;
      const a = current.slots.find((s) => s.slotKey === slotKeyA);
      const b = current.slots.find((s) => s.slotKey === slotKeyB);
      if (!a || !b) return prev;
      const slots = current.slots.map((slot) => {
        if (slot.slotKey === slotKeyA) {
          return { ...slot, fieldId: b.fieldId, emphasis: b.emphasis };
        }
        if (slot.slotKey === slotKeyB) {
          return { ...slot, fieldId: a.fieldId, emphasis: a.emphasis };
        }
        return slot;
      });
      const nextLayout: DataFieldLayout = { ...current, slots };
      const next: StoredDataFieldLayouts = {
        ...prev,
        profiles: { ...prev.profiles, [profileId]: nextLayout },
      };
      saveStoredLayouts(next);
      return next;
    });
  }, []);

  return {
    stored,
    layout,
    activeProfile: stored.activeProfile,
    setActiveProfile,
    updateSlotField,
    swapSlots,
    resetProfileLayout,
  };
}

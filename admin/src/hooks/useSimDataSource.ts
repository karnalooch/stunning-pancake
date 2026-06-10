import { useEffect, useState } from 'react';
import { SimulatorApi, type SimTargetInfo } from '../api/client';

export type DataSource = 'production' | 'sim-lab';

export function useSimDataSource(enabled = true) {
  const [simTarget, setSimTarget] = useState<SimTargetInfo | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    SimulatorApi.getSimTarget()
      .then((info) => {
        if (!cancelled) setSimTarget(info);
      })
      .catch(() => {
        if (!cancelled) setSimTarget(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const dashboardDataSource: DataSource =
    simTarget?.dashboard_data_source === 'sim-lab' ? 'sim-lab' : 'production';

  const showSyntheticBanner =
    Boolean(simTarget?.read_federation_enabled)
    && dashboardDataSource === 'sim-lab'
    && !simTarget?.integration_test_mode;

  return {
    simTarget,
    loading,
    dashboardDataSource,
    showSyntheticBanner,
    simLabLabel: simTarget?.sim_lab_label || 'sim-lab',
  };
}

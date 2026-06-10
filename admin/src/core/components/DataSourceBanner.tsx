import React from 'react';
import { Alert, Text } from '@mantine/core';
import { AlertTriangle, FlaskConical } from 'lucide-react';

export interface DataSourceBannerProps {
  dataSource?: 'production' | 'sim-lab';
  synthetic?: boolean;
  federationFallback?: boolean;
  simLabLabel?: string;
}

export const DataSourceBanner: React.FC<DataSourceBannerProps> = ({
  dataSource,
  synthetic,
  federationFallback,
  simLabLabel = 'sim-lab',
}) => {
  const isSimLab = dataSource === 'sim-lab' || synthetic;

  if (!isSimLab && !federationFallback) {
    return null;
  }

  if (federationFallback && !isSimLab) {
    return (
      <Alert
        mb="md"
        color="yellow"
        variant="light"
        icon={<AlertTriangle size={18} />}
        title="Production stats degraded"
      >
        <Text size="sm">
          Sim-lab federation failed — KPIs below are from the production database (cached or partial).
          Re-check sim-lab health before trusting simulator-related metrics.
        </Text>
      </Alert>
    );
  }

  return (
    <Alert
      mb="md"
      color="orange"
      variant="filled"
      icon={<FlaskConical size={18} />}
      title={`Synthetic KPIs — ${simLabLabel}`}
    >
      <Text size="sm">
        Athlete and activity totals are federated from the isolated sim-lab environment, not production.
        Use these numbers for load testing only — never for sponsor reporting or operational decisions.
      </Text>
    </Alert>
  );
};

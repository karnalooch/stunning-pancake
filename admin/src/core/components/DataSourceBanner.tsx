import React from 'react';
import { Alert, Text } from '@mantine/core';
import { FlaskConical } from 'lucide-react';
import { useSimDataSource } from '../../hooks/useSimDataSource';

export const DataSourceBanner: React.FC = () => {
  const { showSyntheticBanner, simLabLabel, loading } = useSimDataSource();

  if (loading || !showSyntheticBanner) {
    return null;
  }

  return (
    <Alert
      variant="light"
      color="teal"
      icon={<FlaskConical size={18} />}
      title="Widok symulacji"
      mb="md"
      radius="md"
    >
      <Text size="sm">
        Dane syntetyczne z <b>{simLabLabel}</b> — nie są danymi produkcyjnymi.
        KPI dashboardu i mapa na żywo pochodzą z izolowanego sim-lab.
      </Text>
    </Alert>
  );
};

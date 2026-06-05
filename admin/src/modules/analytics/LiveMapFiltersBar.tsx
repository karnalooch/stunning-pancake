import React from 'react';
import { Group, Select, ActionIcon, Tooltip } from '@mantine/core';
import { Presentation, BookmarkPlus } from 'lucide-react';
import { POLAND_SIM_CITIES } from './liveMapCities';
import type { LiveMapFilters } from './liveMapFilters';

export type LiveMapFiltersBarProps = {
    filters: LiveMapFilters;
    onChange: (patch: Partial<LiveMapFilters>) => void;
    onSaveBookmark?: () => void;
    compact?: boolean;
};

export const LiveMapFiltersBar: React.FC<LiveMapFiltersBarProps> = ({
    filters,
    onChange,
    onSaveBookmark,
    compact,
}) => (
    <Group gap="xs" data-testid="live-map-filters">
        <Select
            size="xs"
            aria-label="Typ aktywności"
            value={filters.activityType}
            onChange={(v) => onChange({ activityType: (v as LiveMapFilters['activityType']) || 'all' })}
            data={[
                { value: 'all', label: 'Wszystkie' },
                { value: 'bike', label: 'Rower' },
                { value: 'run', label: 'Bieg' },
            ]}
            w={compact ? 100 : 120}
            comboboxProps={{ withinPortal: true }}
        />
        <Select
            size="xs"
            aria-label="Miasto"
            placeholder="Wszystkie miasta"
            clearable
            value={filters.citySlug}
            onChange={(v) => onChange({ citySlug: v })}
            data={POLAND_SIM_CITIES.map((c) => ({ value: c.slug, label: c.name }))}
            w={compact ? 120 : 140}
            comboboxProps={{ withinPortal: true }}
        />
        <Tooltip label="Tryb prezentacji (ukrywa debug)">
            <ActionIcon
                size="md"
                variant={filters.presentationMode ? 'filled' : 'light'}
                color="grape"
                aria-pressed={filters.presentationMode}
                onClick={() => onChange({ presentationMode: !filters.presentationMode })}
            >
                <Presentation size={16} />
            </ActionIcon>
        </Tooltip>
        {onSaveBookmark && (
            <Tooltip label="Zapisz widok">
                <ActionIcon size="md" variant="light" onClick={onSaveBookmark} aria-label="Zapisz widok">
                    <BookmarkPlus size={16} />
                </ActionIcon>
            </Tooltip>
        )}
    </Group>
);

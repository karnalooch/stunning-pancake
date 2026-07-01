import type { DataSourceBannerProps } from '../core/components/DataSourceBanner';

export type DataSourceBannerView =
    | { kind: 'hidden' }
    | { kind: 'sim-lab'; simLabLabel: string }
    | { kind: 'fallback' };

/** Pure view-model for DataSourceBanner — easy to unit test without Mantine/jsdom. */
export function resolveDataSourceBannerView(props: DataSourceBannerProps): DataSourceBannerView {
    const isSimLab = props.dataSource === 'sim-lab' || Boolean(props.synthetic);

    if (!isSimLab && !props.federationFallback) {
        return { kind: 'hidden' };
    }

    if (props.federationFallback && !isSimLab) {
        return { kind: 'fallback' };
    }

    return { kind: 'sim-lab', simLabLabel: props.simLabLabel || 'sim-lab' };
}

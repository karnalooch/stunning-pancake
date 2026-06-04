import { describe, expect, it } from 'vitest';
import { classifyMapLibreError } from '../core/map/mapErrorPolicy';

const STYLE = 'https://tiles.openfreemap.org/styles/positron';

describe('classifyMapLibreError', () => {
    it('ignores glyph errors after the map has loaded', () => {
        expect(
            classifyMapLibreError(
                { error: { message: 'Failed to load glyph range', url: 'https://tiles.openfreemap.org/fonts/Noto%20Sans%20Bold/0-255.pbf' } },
                STYLE,
                true,
            ),
        ).toBe('ignorable');
    });

    it('treats style JSON failure as fatal before load', () => {
        expect(
            classifyMapLibreError(
                {
                    error: {
                        message: 'Failed to fetch',
                        status: 404,
                        url: 'https://tiles.openfreemap.org/styles/positron',
                    },
                },
                STYLE,
                false,
            ),
        ).toBe('fatal');
    });

    it('ignores generic tile errors once the basemap is visible', () => {
        expect(
            classifyMapLibreError(
                {
                    error: {
                        message: 'Failed to load tile',
                        status: 500,
                        url: 'https://tiles.openfreemap.org/data/v3/5/18/10.pbf',
                    },
                },
                STYLE,
                true,
            ),
        ).toBe('ignorable');
    });
});

import { stringsPl } from '../../src/i18n/strings.pl';
import { stringsEn } from '../../src/i18n/strings.en';

type Catalog = Record<string, unknown>;

/** Collect every leaf key path (dot-notation) from a nested catalog. */
function keyPaths(obj: Catalog, prefix = ''): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...keyPaths(value as Catalog, path));
    } else {
      out.push(path);
    }
  }
  return out.sort();
}

describe('i18n catalog parity (PL <-> EN)', () => {
  const plPaths = keyPaths(stringsPl as Catalog);
  const enPaths = keyPaths(stringsEn as Catalog);

  test('PL and EN expose the identical key structure', () => {
    const missingInEn = plPaths.filter((p) => !enPaths.includes(p));
    const missingInPl = enPaths.filter((p) => !plPaths.includes(p));
    expect({ missingInEn, missingInPl }).toEqual({ missingInEn: [], missingInPl: [] });
  });

  test('no empty string values in either catalog', () => {
    const emptyPl = plPaths.filter((p) => readPath(stringsPl as Catalog, p) === '');
    const emptyEn = enPaths.filter((p) => readPath(stringsEn as Catalog, p) === '');
    expect({ emptyPl, emptyEn }).toEqual({ emptyPl: [], emptyEn: [] });
  });
});

function readPath(obj: Catalog, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Catalog)[key];
    return undefined;
  }, obj);
}

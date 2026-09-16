import type { DepartmentTreeNode, PublicTenantOption } from '../../src/services/api';
import {
  filterTenants,
  flattenDepartments,
  isJoinableDepartmentId,
} from '../../src/screens/onboardingModel';

describe('onboardingModel', () => {
  it('filters the API-driven tenant list without hard-coded city assumptions', () => {
    const tenants: PublicTenantOption[] = [
      { id: 'siedlce-city', name: 'Siedlce' },
      { id: 'warsaw-city', name: 'Warszawa' },
      { id: 'gdansk-city', name: 'Gdańsk' },
    ];

    expect(filterTenants(tenants, 'war')).toEqual([{ id: 'warsaw-city', name: 'Warszawa' }]);
    expect(filterTenants(tenants, '')).toEqual(tenants);
  });

  it('flattens nested API teams while preserving their ids', () => {
    const tree = [
      {
        id: 1,
        name: 'Road',
        department_type: 'TEAM',
        member_count: 4,
        children: [
          {
            id: 2,
            name: 'Road A',
            department_type: 'TEAM',
            member_count: 2,
          },
        ],
      },
    ] as DepartmentTreeNode[];

    expect(flattenDepartments(tree).map((row) => row.id)).toEqual([1, 2]);
  });

  it('only allows real positive department ids to self-join', () => {
    expect(isJoinableDepartmentId(8)).toBe(true);
    expect(isJoinableDepartmentId(null)).toBe(false);
    expect(isJoinableDepartmentId(0)).toBe(false);
    expect(isJoinableDepartmentId(-1)).toBe(false);
  });
});

import { useQuery } from '@tanstack/react-query';
import { AdminApi } from '../../api/client';

export interface UsersListParams {
  cursor: string | null;
  pageSize: number;
  search: string;
  role: string | null;
  tenantId: string | null;
  sortBy: string;
  sortOrder: string;
}

export function useUsersList(params: UsersListParams, enabled = true) {
  const { cursor, pageSize, search, role, tenantId, sortBy, sortOrder } = params;
  return useQuery({
    queryKey: ['users', 'list', cursor, pageSize, search, role, tenantId, sortBy, sortOrder],
    queryFn: () => {
      const query: Record<string, string | number | null> = {
        cursor,
        page_size: pageSize,
        sort: sortBy,
        order: sortOrder,
      };
      if (search.trim()) query.search = search.trim();
      if (role) query.role = role;
      if (tenantId) query.tenant_id = tenantId;
      return AdminApi.getUsers(query);
    },
    enabled,
    staleTime: 10_000,
  });
}

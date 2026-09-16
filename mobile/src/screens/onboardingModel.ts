import type { DepartmentTreeNode, PublicTenantOption } from '../services/api';

export function flattenDepartments(nodes: DepartmentTreeNode[]): DepartmentTreeNode[] {
  const out: DepartmentTreeNode[] = [];
  for (const node of nodes) {
    out.push(node);
    if (node.children?.length) out.push(...flattenDepartments(node.children));
  }
  return out;
}

export function filterTenants(
  tenants: PublicTenantOption[],
  query: string,
): PublicTenantOption[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return tenants;
  return tenants.filter((tenant) => tenant.name.toLocaleLowerCase().includes(normalized));
}

export function isJoinableDepartmentId(departmentId: number | null): boolean {
  return departmentId != null && departmentId > 0;
}

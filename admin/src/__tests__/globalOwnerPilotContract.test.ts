import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const USERS = path.resolve(TEST_DIR, '../modules/users/Users.tsx');
const readUsers = () => fs.readFileSync(USERS, 'utf8');

describe('T86 GLOBAL_OWNER pilot UI contract', () => {
  it('excludes the current GLOBAL_OWNER from bulk selection', () => {
    const source = readUsers();

    expect(source).toContain('const isCurrentGlobalOwner = (targetUserId: number) =>');
    expect(source).toContain('.filter((candidate) => !isCurrentGlobalOwner(candidate.id))');
    expect(source).toContain('disabled={isCurrentGlobalOwner(u.id)}');
    expect(source).toContain('if (isCurrentGlobalOwner(u.id)) return;');
  });

  it('does not offer lock or delete actions against the current GLOBAL_OWNER', () => {
    const source = readUsers();

    expect(source).toContain('{!isCurrentGlobalOwner(u.id) && (');
    expect(source).toContain('{canDeleteUsers && !isCurrentGlobalOwner(u.id) && (');
    expect(source).toContain('if (isCurrentGlobalOwner(userRow.id)) return;');
    expect(source).toContain('if (!deleteTarget || isCurrentGlobalOwner(deleteTarget.id)) return;');
  });

  it('locks destructive self-edits in the profile drawer', () => {
    const source = readUsers();

    expect(source).toContain(
      'disabled={selectedRoleIsLockedForTenantAdmin || selectedUserIsCurrentGlobalOwner}',
    );
    expect(source).toContain('disabled={selectedUserIsCurrentGlobalOwner}');
    expect(source).toContain("is_active: editingCurrentGlobalOwner ? true : editForm.is_active");
    expect(source).toContain(
      "updatePayload.role = editingCurrentGlobalOwner ? 'GLOBAL_OWNER' : editForm.role",
    );
  });

  it('keeps GLOBAL_OWNER tenant-neutral in supported UI mutations', () => {
    const source = readUsers();

    expect(source).toContain(
      "tenant_id: createForm.role === 'GLOBAL_OWNER' ? undefined : createForm.tenant_id || undefined",
    );
    expect(source).toContain("editForm.role !== 'GLOBAL_OWNER'");
    expect(source).toContain("{isGlobalOwner && editForm.role !== 'GLOBAL_OWNER' && (");
    expect(source).toContain(
      "isGlobalOwner && bulkChangeRoleForm.role !== 'GLOBAL_OWNER' && bulkChangeRoleForm.update_tenant",
    );
  });
});

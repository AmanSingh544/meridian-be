import { UserRole } from '@prisma/client';
import { getPermissionsForRole, ROLE_PERMISSIONS } from './permissions';

describe('Permissions', () => {
  describe('getPermissionsForRole', () => {
    it('should return base permissions for a role without overrides', () => {
      const result = getPermissionsForRole(UserRole.CLIENT_USER);
      expect(result).toEqual(ROLE_PERMISSIONS[UserRole.CLIENT_USER]);
    });

    it('should grant additional permissions', () => {
      const result = getPermissionsForRole(UserRole.CLIENT_USER, [
        { permission: 'TICKET_EDIT', type: 'GRANT' },
      ]);
      expect(result).toContain('TICKET_EDIT');
      expect(result).toContain('TICKET_CREATE');
    });

    it('should revoke permissions', () => {
      const result = getPermissionsForRole(UserRole.CLIENT_USER, [
        { permission: 'TICKET_CREATE', type: 'REVOKE' },
      ]);
      expect(result).not.toContain('TICKET_CREATE');
      expect(result).toContain('TICKET_VIEW_OWN');
    });

    it('should return empty array for unknown roles', () => {
      const result = getPermissionsForRole('UNKNOWN_ROLE' as UserRole);
      expect(result).toEqual([]);
    });
  });

  describe('ROLE_PERMISSIONS', () => {
    it('should define permissions for all known roles', () => {
      expect(ROLE_PERMISSIONS[UserRole.CLIENT_USER]).toBeDefined();
      expect(ROLE_PERMISSIONS[UserRole.CLIENT_ADMIN]).toBeDefined();
      expect(ROLE_PERMISSIONS[UserRole.AGENT]).toBeDefined();
      expect(ROLE_PERMISSIONS[UserRole.LEAD]).toBeDefined();
      expect(ROLE_PERMISSIONS[UserRole.ADMIN]).toBeDefined();
    });

    it('should not have duplicate permissions within a role', () => {
      Object.values(ROLE_PERMISSIONS).forEach((perms) => {
        expect(new Set(perms).size).toBe(perms.length);
      });
    });
  });
});

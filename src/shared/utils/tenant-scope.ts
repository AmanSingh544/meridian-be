import { BadRequestException } from '@nestjs/common';

export interface TenantContext {
  tenantId: string | undefined;
  role: string;
}

/**
 * Returns a Prisma `where` fragment for tenant scoping.
 * Spread into any Prisma where object: { ...buildTenantWhere(ctx), status: 'active' }
 *
 * ADMIN (any tenantId)    → global (no filter) — ADMIN can access all tenants
 * non-ADMIN + tenantId    → scoped to that tenant
 * non-ADMIN, no tenantId  → throws 400
 */
export function buildTenantWhere(ctx: TenantContext): Record<string, any> {
  if (ctx.role === 'ADMIN') return {};
  if (ctx.tenantId) return { tenant_id: ctx.tenantId };
  throw new BadRequestException('tenant_id is required');
}

export function canAccessAllTenants(role: string): boolean {
  return role === 'ADMIN';
}

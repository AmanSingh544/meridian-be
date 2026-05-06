import { BadRequestException } from '@nestjs/common';

export interface TenantContext {
  tenantId: string | undefined;
  role: string;
}

/**
 * Returns a Prisma `where` fragment for tenant scoping.
 * Spread into any Prisma where object: { ...buildTenantWhere(ctx), status: 'active' }
 *
 * tenantId present (any role) → scoped to that tenant
 * tenantId absent + ADMIN     → global (no filter)
 * tenantId absent + non-ADMIN → throws 400
 */
export function buildTenantWhere(ctx: TenantContext): Record<string, any> {
  if (ctx.tenantId) return { tenant_id: ctx.tenantId };
  if (ctx.role === 'ADMIN') return {};
  throw new BadRequestException('tenant_id is required');
}

export function canAccessAllTenants(role: string): boolean {
  return role === 'ADMIN';
}

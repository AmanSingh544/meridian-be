import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

interface TicketContext {
  priority: string;       // DB enum value e.g. URGENT, HIGH, MEDIUM, LOW
  category: string | null;
  tags: string[];
  title: string;
  description: string | null;
  organization_id: string | null; // from metadata.organization_id if stored
}

@Injectable()
export class RoutingRulesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const data = await this.prisma.routingRule.findMany({
      where: { tenant_id: tenantId },
      orderBy: { priority: 'asc' },
    });
    return { data };
  }

  async create(tenantId: string, dto: any) {
    const data: any = { tenant_id: tenantId };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.condition !== undefined) {
      data.condition = Array.isArray(dto.condition) ? dto.condition : [];
    }
    if (dto.action !== undefined) data.action = dto.action;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;

    const rule = await this.prisma.routingRule.create({ data });
    return { data: rule };
  }

  async update(id: string, tenantId: string, dto: any) {
    const rule = await this.prisma.routingRule.findFirst({ where: { id, tenant_id: tenantId } });
    if (!rule) throw new NotFoundException('Routing rule not found');

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.condition !== undefined) {
      updateData.condition = Array.isArray(dto.condition) ? dto.condition : [];
    }
    if (dto.action !== undefined) updateData.action = dto.action;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.is_active !== undefined) updateData.is_active = dto.is_active;

    const updated = await this.prisma.routingRule.update({ where: { id }, data: updateData });
    return { data: updated };
  }

  async remove(id: string, tenantId: string) {
    const rule = await this.prisma.routingRule.findFirst({ where: { id, tenant_id: tenantId } });
    if (!rule) throw new NotFoundException('Routing rule not found');
    await this.prisma.routingRule.delete({ where: { id } });
    return { success: true, message: 'Routing rule deleted' };
  }

  /**
   * Evaluate active routing rules against a ticket's properties.
   * Returns the assignee UUID from the first matching rule's action, or null if none match.
   * Rules are evaluated in ascending priority order (priority 1 = highest).
   */
  async evaluate(tenantId: string, ticket: TicketContext): Promise<string | null> {
    const rules = await this.prisma.routingRule.findMany({
      where: { tenant_id: tenantId, is_active: true },
      orderBy: { priority: 'asc' },
    });

    for (const rule of rules) {
      const conditions = Array.isArray(rule.condition) ? rule.condition : [];
      if (conditions.length === 0) continue;

      const allMatch = conditions.every((c: any) => this.matchCondition(c, ticket));
      if (allMatch) {
        const assignTo: string | undefined = (rule.action as any)?.assignTo ?? (rule.action as any)?.assign_to;
        if (assignTo) return assignTo;
      }
    }

    return null;
  }

  private matchCondition(c: any, ticket: TicketContext): boolean {
    const field: string = c?.field;
    const operator: string = c?.operator;
    const condValue = c?.value;

    if (!field || !operator) return false;

    // Normalise condValue to an array for set-based operators
    const condValues: string[] = Array.isArray(condValue)
      ? condValue.map((v: string) => String(v).toUpperCase())
      : [String(condValue ?? '').toUpperCase()];

    switch (field) {
      case 'priority': {
        // Both sides normalised to uppercase; CRITICAL is stored as URGENT in DB
        const ticketPriority = this.normalisePriority(ticket.priority);
        return this.evalStringOp(operator, ticketPriority, condValues);
      }

      case 'category': {
        if (!ticket.category) return false;
        const ticketCategory = ticket.category.toUpperCase();
        return this.evalStringOp(operator, ticketCategory, condValues);
      }

      case 'organization_id': {
        // organization_id is stored in ticket metadata (no dedicated column)
        if (!ticket.organization_id) return false;
        return this.evalStringOp(operator, ticket.organization_id.toUpperCase(), condValues);
      }

      case 'tags': {
        if (operator !== 'contains') return false;
        const needle = String(condValue ?? '').toLowerCase();
        return ticket.tags.some(t => t.toLowerCase() === needle);
      }

      case 'keyword': {
        if (operator !== 'contains') return false;
        const needle = String(condValue ?? '').toLowerCase();
        const haystack = [ticket.title, ticket.description ?? ''].join(' ').toLowerCase();
        return haystack.includes(needle);
      }

      default:
        // Unknown field — treat as non-matching so rules are never silently applied
        return false;
    }
  }

  private normalisePriority(p: string): string {
    // DB stores URGENT; UI/API surface uses CRITICAL — treat as the same
    const upper = p.toUpperCase();
    return upper === 'URGENT' ? 'CRITICAL' : upper;
  }

  private evalStringOp(operator: string, ticketValue: string, condValues: string[]): boolean {
    switch (operator) {
      case 'equals':
        return condValues.length > 0 && ticketValue === condValues[0];
      case 'in':
        return condValues.includes(ticketValue);
      case 'not_in':
        return !condValues.includes(ticketValue);
      default:
        return false;
    }
  }
}

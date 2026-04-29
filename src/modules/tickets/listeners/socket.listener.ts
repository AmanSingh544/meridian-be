import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eventBus } from '../../../events/event-bus';
import {
  TICKET_EVENTS,
  TicketCreatedPayload,
  TicketStatusChangedPayload,
  TicketAssignedPayload,
  TicketCommentedPayload,
  TicketUpdatedPayload,
} from '../../../events/ticket.events';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

@Injectable()
export class SocketListener implements OnModuleInit {
  private readonly logger = new Logger(SocketListener.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  onModuleInit() {
    eventBus.on(TICKET_EVENTS.CREATED,       (p: TicketCreatedPayload)       => this.onCreated(p));
    eventBus.on(TICKET_EVENTS.UPDATED,       (p: TicketUpdatedPayload)       => this.onUpdated(p));
    eventBus.on(TICKET_EVENTS.STATUS_CHANGED, (p: TicketStatusChangedPayload) => this.onStatusChanged(p));
    eventBus.on(TICKET_EVENTS.ASSIGNED,      (p: TicketAssignedPayload)      => this.onAssigned(p));
    eventBus.on(TICKET_EVENTS.COMMENTED,     (p: TicketCommentedPayload)     => this.onCommented(p));
  }

  private onCreated(p: TicketCreatedPayload) {
    try {
      this.gateway.emitToTenant(p.ticket.tenant_id, 'ticket.created', {
        ticket_id: p.ticket.id,
        ticket_number: p.ticket.ticket_number,
        title: p.ticket.title,
        status: p.ticket.status,
        priority: p.ticket.priority,
      });
    } catch (err) {
      this.logger.error(`SocketListener.onCreated failed: ${(err as Error).message}`);
    }
  }

  private onUpdated(p: TicketUpdatedPayload) {
    try {
      this.gateway.emitToTenant(p.ticket.tenant_id, 'ticket.updated', {
        ticket_id: p.ticket.id,
        ticket_number: p.ticket.ticket_number,
        title: p.ticket.title,
      });
    } catch (err) {
      this.logger.error(`SocketListener.onUpdated failed: ${(err as Error).message}`);
    }
  }

  private onStatusChanged(p: TicketStatusChangedPayload) {
    try {
      this.gateway.emitToTenant(p.ticket.tenant_id, 'ticket.status_changed', {
        ticket_id: p.ticket.id,
        ticket_number: p.ticket.ticket_number,
        previous_status: p.previousStatus,
        new_status: p.ticket.status,
      });
    } catch (err) {
      this.logger.error(`SocketListener.onStatusChanged failed: ${(err as Error).message}`);
    }
  }

  private onAssigned(p: TicketAssignedPayload) {
    try {
      // Targeted — only the newly assigned user needs the ping
      this.gateway.emitToUser(p.assignee.id, 'ticket.assigned', {
        ticket_id: p.ticket.id,
        ticket_number: p.ticket.ticket_number,
        title: p.ticket.title,
        priority: p.ticket.priority,
      });
      // Also broadcast to tenant so team views refresh
      this.gateway.emitToTenant(p.ticket.tenant_id, 'ticket.updated', {
        ticket_id: p.ticket.id,
        ticket_number: p.ticket.ticket_number,
      });
    } catch (err) {
      this.logger.error(`SocketListener.onAssigned failed: ${(err as Error).message}`);
    }
  }

  private onCommented(p: TicketCommentedPayload) {
    try {
      // Internal comments only go to the tenant (agents), not public broadcast
      const event = p.comment.is_internal ? 'ticket.internal_comment' : 'ticket.commented';
      this.gateway.emitToTenant(p.ticket.tenant_id, event, {
        ticket_id: p.ticket.id,
        ticket_number: p.ticket.ticket_number,
        comment_id: p.comment.id,
        author_id: p.actor.id,
      });
    } catch (err) {
      this.logger.error(`SocketListener.onCommented failed: ${(err as Error).message}`);
    }
  }
}

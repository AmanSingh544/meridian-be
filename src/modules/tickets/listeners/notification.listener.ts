import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eventBus } from '../../../events/event-bus';
import {
  TICKET_EVENTS,
  TicketCreatedPayload,
  TicketStatusChangedPayload,
  TicketAssignedPayload,
  TicketCommentedPayload,
} from '../../../events/ticket.events';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class NotificationListener implements OnModuleInit {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(private readonly notifService: NotificationsService) {}

  onModuleInit() {
    eventBus.on(TICKET_EVENTS.CREATED,        (p: TicketCreatedPayload)       => void this.onCreated(p));
    eventBus.on(TICKET_EVENTS.STATUS_CHANGED,  (p: TicketStatusChangedPayload) => void this.onStatusChanged(p));
    eventBus.on(TICKET_EVENTS.ASSIGNED,        (p: TicketAssignedPayload)      => void this.onAssigned(p));
    eventBus.on(TICKET_EVENTS.COMMENTED,       (p: TicketCommentedPayload)     => void this.onCommented(p));
  }

  private async onCreated(p: TicketCreatedPayload) {
    try {
      if (!p.ticket.requester_id) return;
      await this.notifService.create({
        tenant_id: p.ticket.tenant_id,
        user_id: p.ticket.requester_id,
        type: 'ticket.created',
        title: `Ticket ${p.ticket.ticket_number} created`,
        body: p.ticket.title,
        data: { ticket_id: p.ticket.id, ticket_number: p.ticket.ticket_number },
      });
    } catch (err) {
      this.logger.error(`NotificationListener.onCreated failed: ${(err as Error).message}`);
    }
  }

  private async onStatusChanged(p: TicketStatusChangedPayload) {
    try {
      const targets = [
        p.ticket.requester_id,
        p.ticket.assignee_id !== p.ticket.requester_id ? p.ticket.assignee_id : null,
      ].filter(Boolean) as string[];

      const body = `Status changed: ${p.previousStatus} → ${p.ticket.status}`;

      await Promise.all(
        targets.map((userId) =>
          this.notifService.create({
            tenant_id: p.ticket.tenant_id,
            user_id: userId,
            type: 'ticket.status_changed',
            title: `Ticket ${p.ticket.ticket_number} updated`,
            body,
            data: {
              ticket_id: p.ticket.id,
              ticket_number: p.ticket.ticket_number,
              previous_status: p.previousStatus,
              new_status: p.ticket.status,
            },
          }),
        ),
      );
    } catch (err) {
      this.logger.error(`NotificationListener.onStatusChanged failed: ${(err as Error).message}`);
    }
  }

  private async onAssigned(p: TicketAssignedPayload) {
    try {
      await this.notifService.create({
        tenant_id: p.ticket.tenant_id,
        user_id: p.assignee.id,
        type: 'ticket.assigned',
        title: `Ticket ${p.ticket.ticket_number} assigned to you`,
        body: p.ticket.title,
        data: { ticket_id: p.ticket.id, ticket_number: p.ticket.ticket_number },
      });
    } catch (err) {
      this.logger.error(`NotificationListener.onAssigned failed: ${(err as Error).message}`);
    }
  }

  private async onCommented(p: TicketCommentedPayload) {
    try {
      if (p.comment.is_internal) return;

      const authorName = p.actor.first_name
        ? `${p.actor.first_name} ${p.actor.last_name}`.trim()
        : p.actor.email;

      const targets = [
        p.ticket.requester_id !== p.actor.id ? p.ticket.requester_id : null,
        p.ticket.assignee_id && p.ticket.assignee_id !== p.actor.id ? p.ticket.assignee_id : null,
      ].filter(Boolean) as string[];

      // deduplicate in case requester === assignee
      const uniqueTargets = [...new Set(targets)];

      await Promise.all(
        uniqueTargets.map((userId) =>
          this.notifService.create({
            tenant_id: p.ticket.tenant_id,
            user_id: userId,
            type: 'ticket.commented',
            title: `New comment on ${p.ticket.ticket_number}`,
            body: `${authorName}: ${p.comment.body.slice(0, 120)}`,
            data: {
              ticket_id: p.ticket.id,
              ticket_number: p.ticket.ticket_number,
              comment_id: p.comment.id,
            },
          }),
        ),
      );
    } catch (err) {
      this.logger.error(`NotificationListener.onCommented failed: ${(err as Error).message}`);
    }
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eventBus } from '../../../events/event-bus';
import {
  TICKET_EVENTS,
  TicketCreatedPayload,
  TicketStatusChangedPayload,
  TicketAssignedPayload,
  TicketCommentedPayload,
} from '../../../events/ticket.events';
import { EmailQueue } from '../../email/email.queue';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { ticketCreatedTemplate } from '../../email/templates/ticket-created.template';
import { ticketStatusChangedTemplate } from '../../email/templates/ticket-status-changed.template';
import { ticketAssignedTemplate } from '../../email/templates/ticket-assigned.template';
import { commentAddedTemplate } from '../../email/templates/comment-added.template';

@Injectable()
export class EmailListener implements OnModuleInit {
  private readonly logger = new Logger(EmailListener.name);

  constructor(
    private readonly emailQueue: EmailQueue,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  onModuleInit() {
    eventBus.on(TICKET_EVENTS.CREATED,        (p: TicketCreatedPayload)       => void this.onCreated(p));
    eventBus.on(TICKET_EVENTS.STATUS_CHANGED,  (p: TicketStatusChangedPayload) => void this.onStatusChanged(p));
    eventBus.on(TICKET_EVENTS.ASSIGNED,        (p: TicketAssignedPayload)      => void this.onAssigned(p));
    eventBus.on(TICKET_EVENTS.COMMENTED,       (p: TicketCommentedPayload)     => void this.onCommented(p));
  }

  private async onCreated(p: TicketCreatedPayload) {
    try {
      const flags = await this.systemSettings.getNotificationFlags(p.ticket.tenant_id);
      if (!flags.emailOnTicketCreated) return;
      if (!p.requester?.email) return;

      const { subject, html } = ticketCreatedTemplate({
        ticketNumber: p.ticket.ticket_number,
        title: p.ticket.title,
        priority: p.ticket.priority,
        category: p.ticket.category,
        recipientName: p.requester.first_name || p.requester.email,
      });
      await this.emailQueue.add({ to: p.requester.email, subject, html });
    } catch (err) {
      this.logger.error(`EmailListener.onCreated failed: ${(err as Error).message}`);
    }
  }

  private async onStatusChanged(p: TicketStatusChangedPayload) {
    try {
      const flags = await this.systemSettings.getNotificationFlags(p.ticket.tenant_id);
      if (!flags.emailOnTicketStatusChanged) return;

      const recipients: Array<{ email: string; name: string }> = [];
      if (p.requester?.email) recipients.push({ email: p.requester.email, name: p.requester.first_name || p.requester.email });
      if (p.assignee?.email && p.assignee.id !== p.requester?.id) {
        recipients.push({ email: p.assignee.email, name: p.assignee.first_name || p.assignee.email });
      }

      for (const r of recipients) {
        const { subject, html } = ticketStatusChangedTemplate({
          ticketNumber: p.ticket.ticket_number,
          title: p.ticket.title,
          previousStatus: p.previousStatus,
          newStatus: p.ticket.status,
          recipientName: r.name,
        });
        await this.emailQueue.add({ to: r.email, subject, html });
      }
    } catch (err) {
      this.logger.error(`EmailListener.onStatusChanged failed: ${(err as Error).message}`);
    }
  }

  private async onAssigned(p: TicketAssignedPayload) {
    try {
      const flags = await this.systemSettings.getNotificationFlags(p.ticket.tenant_id);
      if (!flags.emailOnTicketAssigned) return;
      if (!p.assignee?.email) return;

      const { subject, html } = ticketAssignedTemplate({
        ticketNumber: p.ticket.ticket_number,
        title: p.ticket.title,
        priority: p.ticket.priority,
        category: p.ticket.category,
        recipientName: p.assignee.first_name || p.assignee.email,
        assignedByName: p.actor.first_name
          ? `${p.actor.first_name} ${p.actor.last_name}`.trim()
          : p.actor.email,
      });
      await this.emailQueue.add({ to: p.assignee.email, subject, html });
    } catch (err) {
      this.logger.error(`EmailListener.onAssigned failed: ${(err as Error).message}`);
    }
  }

  private async onCommented(p: TicketCommentedPayload) {
    try {
      // Internal (private) comments don't trigger external emails
      if (p.comment.is_internal) return;

      const flags = await this.systemSettings.getNotificationFlags(p.ticket.tenant_id);
      if (!flags.emailOnCommentAdded) return;

      const authorName = p.actor.first_name
        ? `${p.actor.first_name} ${p.actor.last_name}`.trim()
        : p.actor.email;

      const recipients: Array<{ email: string; name: string }> = [];

      // Notify requester (unless they wrote the comment)
      if (p.requester?.email && p.requester.id !== p.actor.id) {
        recipients.push({ email: p.requester.email, name: p.requester.first_name || p.requester.email });
      }
      // Notify assignee (unless they wrote the comment, and unless they're the requester)
      if (
        p.assignee?.email &&
        p.assignee.id !== p.actor.id &&
        p.assignee.id !== p.requester?.id
      ) {
        recipients.push({ email: p.assignee.email, name: p.assignee.first_name || p.assignee.email });
      }

      for (const r of recipients) {
        const { subject, html } = commentAddedTemplate({
          ticketNumber: p.ticket.ticket_number,
          ticketTitle: p.ticket.title,
          commentBody: p.comment.body,
          authorName,
          recipientName: r.name,
        });
        await this.emailQueue.add({ to: r.email, subject, html });
      }
    } catch (err) {
      this.logger.error(`EmailListener.onCommented failed: ${(err as Error).message}`);
    }
  }
}

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
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import { NotificationChannel } from '../../../shared/enums/notification-channel.enum';
import { ticketCreatedTemplate } from '../../email/templates/ticket-created.template';
import { ticketStatusChangedTemplate } from '../../email/templates/ticket-status-changed.template';
import { ticketAssignedTemplate } from '../../email/templates/ticket-assigned.template';
import { commentAddedTemplate } from '../../email/templates/comment-added.template';
import { mentionTemplate } from '../../email/templates/mention.template';

interface Recipient {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  channel: NotificationChannel;
}

@Injectable()
export class EmailListener implements OnModuleInit {
  private readonly logger = new Logger(EmailListener.name);

  constructor(
    private readonly emailQueue: EmailQueue,
    private readonly systemSettings: SystemSettingsService,
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  onModuleInit() {
    eventBus.on(TICKET_EVENTS.CREATED,        (p: TicketCreatedPayload)       => void this.onCreated(p));
    eventBus.on(TICKET_EVENTS.STATUS_CHANGED,  (p: TicketStatusChangedPayload) => void this.onStatusChanged(p));
    eventBus.on(TICKET_EVENTS.ASSIGNED,        (p: TicketAssignedPayload)      => void this.onAssigned(p));
    eventBus.on(TICKET_EVENTS.COMMENTED,       (p: TicketCommentedPayload)     => void this.onCommented(p));
  }

  /** Resolve preferred channel + phone for a user. Defaults to EMAIL. */
  private async resolveRecipient(userId: string, email: string, name: string): Promise<Recipient> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const prefs = (user?.preferences as Record<string, any>) || {};
    const channel = (prefs.preferred_channel as NotificationChannel) || NotificationChannel.EMAIL;
    const phone = (prefs.whatsapp_number as string) || null;

    return { id: userId, email, name, phone, channel };
  }

  private async dispatchEmail(to: string, subject: string, html: string): Promise<void> {
    await this.emailQueue.add({ to, subject, html });
  }

  private async dispatchWhatsApp(recipient: Recipient, templateName: string, params: Record<string, string>): Promise<void> {
    if (!recipient.phone) {
      this.logger.warn(`User ${recipient.id} prefers WhatsApp but has no phone number — falling back to email`);
      return;
    }
    await this.whatsapp.send({ to: recipient.phone, templateName, params });
  }

  private async onCreated(p: TicketCreatedPayload) {
    try {
      const flags = await this.systemSettings.getNotificationFlags(p.ticket.tenant_id);
      if (!flags.emailOnTicketCreated) return;
      if (!p.requester?.email) return;

      const r = await this.resolveRecipient(p.requester.id, p.requester.email, p.requester.first_name || p.requester.email);

      if (r.channel === NotificationChannel.WHATSAPP) {
        await this.dispatchWhatsApp(r, 'ticket_created', {
          ticket_number: p.ticket.ticket_number,
          title: p.ticket.title,
          recipient_name: r.name,
        });
        return;
      }

      const { subject, html } = ticketCreatedTemplate({
        ticketNumber: p.ticket.ticket_number,
        title: p.ticket.title,
        priority: p.ticket.priority,
        category: p.ticket.category,
        recipientName: r.name,
      });
      await this.dispatchEmail(r.email, subject, html);
    } catch (err) {
      this.logger.error(`EmailListener.onCreated failed: ${(err as Error).message}`);
    }
  }

  private async onStatusChanged(p: TicketStatusChangedPayload) {
    try {
      const flags = await this.systemSettings.getNotificationFlags(p.ticket.tenant_id);
      if (!flags.emailOnTicketStatusChanged) return;

      const rawRecipients: Array<{ id: string; email: string; name: string }> = [];
      if (p.requester?.email) rawRecipients.push({ id: p.requester.id, email: p.requester.email, name: p.requester.first_name || p.requester.email });
      if (p.assignee?.email && p.assignee.id !== p.requester?.id) {
        rawRecipients.push({ id: p.assignee.id, email: p.assignee.email, name: p.assignee.first_name || p.assignee.email });
      }

      for (const raw of rawRecipients) {
        const r = await this.resolveRecipient(raw.id, raw.email, raw.name);

        if (r.channel === NotificationChannel.WHATSAPP) {
          await this.dispatchWhatsApp(r, 'ticket_status_changed', {
            ticket_number: p.ticket.ticket_number,
            title: p.ticket.title,
            previous_status: p.previousStatus,
            new_status: p.ticket.status,
            recipient_name: r.name,
          });
          continue;
        }

        const { subject, html } = ticketStatusChangedTemplate({
          ticketNumber: p.ticket.ticket_number,
          title: p.ticket.title,
          previousStatus: p.previousStatus,
          newStatus: p.ticket.status,
          recipientName: r.name,
        });
        await this.dispatchEmail(r.email, subject, html);
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

      const r = await this.resolveRecipient(p.assignee.id, p.assignee.email, p.assignee.first_name || p.assignee.email);

      if (r.channel === NotificationChannel.WHATSAPP) {
        await this.dispatchWhatsApp(r, 'ticket_assigned', {
          ticket_number: p.ticket.ticket_number,
          title: p.ticket.title,
          priority: p.ticket.priority,
          category: p.ticket.category,
          recipient_name: r.name,
          assigned_by: p.actor.first_name ? `${p.actor.first_name} ${p.actor.last_name}`.trim() : p.actor.email,
        });
        return;
      }

      const { subject, html } = ticketAssignedTemplate({
        ticketNumber: p.ticket.ticket_number,
        title: p.ticket.title,
        priority: p.ticket.priority,
        category: p.ticket.category,
        recipientName: r.name,
        assignedByName: p.actor.first_name
          ? `${p.actor.first_name} ${p.actor.last_name}`.trim()
          : p.actor.email,
      });
      await this.dispatchEmail(r.email, subject, html);
    } catch (err) {
      this.logger.error(`EmailListener.onAssigned failed: ${(err as Error).message}`);
    }
  }

  private async onCommented(p: TicketCommentedPayload) {
    try {
      const flags = await this.systemSettings.getNotificationFlags(p.ticket.tenant_id);
      if (!flags.emailOnCommentAdded) return;

      const authorName = p.actor.first_name
        ? `${p.actor.first_name} ${p.actor.last_name}`.trim()
        : p.actor.email;

      // ── Requester / Assignee emails (public comments only) ─────────────
      if (!p.comment.is_internal) {
        const rawRecipients: Array<{ id: string; email: string; name: string }> = [];

        if (p.requester?.email && p.requester.id !== p.actor.id) {
          rawRecipients.push({ id: p.requester.id, email: p.requester.email, name: p.requester.first_name || p.requester.email });
        }
        if (
          p.assignee?.email &&
          p.assignee.id !== p.actor.id &&
          p.assignee.id !== p.requester?.id
        ) {
          rawRecipients.push({ id: p.assignee.id, email: p.assignee.email, name: p.assignee.first_name || p.assignee.email });
        }

        for (const raw of rawRecipients) {
          const r = await this.resolveRecipient(raw.id, raw.email, raw.name);

          if (r.channel === NotificationChannel.WHATSAPP) {
            await this.dispatchWhatsApp(r, 'ticket_commented', {
              ticket_number: p.ticket.ticket_number,
              ticket_title: p.ticket.title,
              comment_body: p.comment.body,
              author_name: authorName,
              recipient_name: r.name,
            });
            continue;
          }

          const { subject, html } = commentAddedTemplate({
            ticketNumber: p.ticket.ticket_number,
            ticketTitle: p.ticket.title,
            commentBody: p.comment.body,
            authorName,
            recipientName: r.name,
          });
          await this.dispatchEmail(r.email, subject, html);
        }
      }

      // ── Mention emails ─────────────────────────────────────────────────
      if (p.mentionTargets.length > 0) {
        const mentionedUsers = await this.prisma.user.findMany({
          where: { id: { in: p.mentionTargets } },
          select: { id: true, email: true, first_name: true, last_name: true, preferences: true },
        });

        for (const user of mentionedUsers) {
          if (!user.email) continue;

          const prefs = (user.preferences as Record<string, any>) || {};
          const emailOnMention = prefs.email_on_mention ?? true;
          if (!emailOnMention) continue;

          const r = await this.resolveRecipient(user.id, user.email, user.first_name || user.email);

          if (r.channel === NotificationChannel.WHATSAPP) {
            await this.dispatchWhatsApp(r, 'ticket_mention', {
              ticket_number: p.ticket.ticket_number,
              ticket_title: p.ticket.title,
              comment_body: p.comment.body,
              author_name: authorName,
              recipient_name: r.name,
            });
            continue;
          }

          const recipientName = user.first_name || user.email;
          const { subject, html } = mentionTemplate({
            ticketNumber: p.ticket.ticket_number,
            ticketTitle: p.ticket.title,
            commentBody: p.comment.body,
            authorName,
            recipientName,
          });
          await this.dispatchEmail(user.email, subject, html);
        }
      }
    } catch (err) {
      this.logger.error(`EmailListener.onCommented failed: ${(err as Error).message}`);
    }
  }
}

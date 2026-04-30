export const TICKET_EVENTS = {
  CREATED:        'ticket.created',
  UPDATED:        'ticket.updated',
  STATUS_CHANGED: 'ticket.status_changed',
  ASSIGNED:       'ticket.assigned',
  COMMENTED:      'ticket.commented',
} as const;

export type TicketEventName = (typeof TICKET_EVENTS)[keyof typeof TICKET_EVENTS];

export interface EventActor {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface TicketEventTicket {
  id: string;
  tenant_id: string;
  ticket_number: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  requester_id: string | null;
  assignee_id: string | null;
}

export interface TicketCreatedPayload {
  ticket: TicketEventTicket;
  actor: EventActor;         // the user who created the ticket (=requester)
  requester: EventActor | null;
  assignee: EventActor | null;
}

export interface TicketUpdatedPayload {
  ticket: TicketEventTicket;
  actor: EventActor;
  assignee: EventActor | null;
  previousAssigneeId: string | null;
}

export interface TicketStatusChangedPayload {
  ticket: TicketEventTicket;
  actor: EventActor;
  requester: EventActor | null;
  assignee: EventActor | null;
  previousStatus: string;
}

export interface TicketAssignedPayload {
  ticket: TicketEventTicket;
  actor: EventActor;
  assignee: EventActor;      // guaranteed non-null — only emitted when there's a new assignee
  previousAssigneeId: string | null;
}

export interface TicketCommentedPayload {
  ticket: TicketEventTicket;
  comment: {
    id: string;
    body: string;
    is_internal: boolean;
  };
  actor: EventActor;         // comment author
  requester: EventActor | null;
  assignee: EventActor | null;
  mentions: string[];        // all mentioned user IDs (for storage / audit)
  mentionTargets: string[];  // user IDs who should actually receive notifications
}

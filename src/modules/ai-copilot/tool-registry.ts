import { Injectable } from '@nestjs/common';
import { ToolDefinition } from './types/tool-definition';

/**
 * Self-describing registry of all AI Copilot tools.
 * Each tool declares its OpenAI function schema and required permissions.
 * The LLM only receives tools that pass the user's permission filter.
 */
@Injectable()
export class ToolRegistry {
  private readonly tools: ToolDefinition[] = [
    // ── Read-only ticket tools ───────────────────────────────────────────────
    {
      name: 'get_ticket_detail',
      description: 'Get detailed information about a specific ticket by its ID or ticket number. Returns title, description, status, priority, assignee, requester, comments, and SLA info.',
      parameters: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'string',
            description: 'The ticket ID (UUID) or ticket number (e.g., TKT-0001)',
          },
        },
        required: ['ticketId'],
      },
      requiredPermissions: ['TICKET_VIEW_OWN', 'TICKET_VIEW_ORG', 'TICKET_VIEW_ALL'],
      isDraftOnly: false,
    },
    {
      name: 'search_tickets',
      description: 'Search and filter tickets. Supports status, priority, assignee, date range, and free-text search.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Free-text search across title and description',
          },
          status: {
            type: 'string',
            description: 'Filter by status: OPEN, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CLOSED, PENDING, ESCALATED',
          },
          priority: {
            type: 'string',
            description: 'Filter by priority: LOW, MEDIUM, HIGH, URGENT',
          },
          assigneeId: {
            type: 'string',
            description: 'Filter by assignee user ID',
          },
          limit: {
            type: 'number',
            description: 'Max results to return (default 10, max 50)',
          },
        },
      },
      requiredPermissions: ['TICKET_VIEW_OWN', 'TICKET_VIEW_ORG', 'TICKET_VIEW_ALL'],
      isDraftOnly: false,
    },
    {
      name: 'get_my_tickets',
      description: 'Get tickets created by or assigned to the current user.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Optional status filter',
          },
          limit: {
            type: 'number',
            description: 'Max results (default 10)',
          },
        },
      },
      requiredPermissions: ['TICKET_VIEW_OWN'],
      isDraftOnly: false,
    },
    {
      name: 'get_recent_tickets',
      description: 'Get recently created or updated tickets.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of tickets to return (default 10, max 50)',
          },
          status: {
            type: 'string',
            description: 'Optional status filter',
          },
        },
      },
      requiredPermissions: ['TICKET_VIEW_ALL'],
      isDraftOnly: false,
    },
    {
      name: 'get_ticket_summary',
      description: 'Generate an AI summary of a ticket including key points, status, and next steps.',
      parameters: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'string',
            description: 'Ticket ID or ticket number',
          },
        },
        required: ['ticketId'],
      },
      requiredPermissions: ['TICKET_VIEW_OWN', 'TICKET_VIEW_ORG', 'TICKET_VIEW_ALL'],
      isDraftOnly: false,
    },
    {
      name: 'get_bug_summary',
      description: 'Get a summary of recent bug tickets including severity and status.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Look back period in days (default 7)',
          },
          limit: {
            type: 'number',
            description: 'Max bugs to include (default 10)',
          },
        },
      },
      requiredPermissions: ['TICKET_VIEW_OWN', 'TICKET_VIEW_ORG', 'TICKET_VIEW_ALL'],
      isDraftOnly: false,
    },

    // ── KB & Project tools ───────────────────────────────────────────────────
    {
      name: 'ask_kb',
      description: 'Ask a question and get an answer grounded in the knowledge base articles.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question to ask',
          },
        },
        required: ['question'],
      },
      requiredPermissions: ['KB_VIEW'],
      isDraftOnly: false,
    },
    {
      name: 'get_project_status',
      description: 'Get the health status, open ticket count, SLA compliance, and predicted delivery for a project.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID (UUID)',
          },
        },
        required: ['projectId'],
      },
      requiredPermissions: ['PROJECT_VIEW'],
      isDraftOnly: false,
    },

    // ── SLA & Workload tools ─────────────────────────────────────────────────
    {
      name: 'get_sla_breaches',
      description: 'Get tickets that have breached or are at risk of breaching SLA.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Filter by status',
          },
          limit: {
            type: 'number',
            description: 'Max results (default 10)',
          },
        },
      },
      requiredPermissions: ['SLA_VIEW'],
      isDraftOnly: false,
    },
    {
      name: 'get_agent_workload',
      description: 'Get current workload and availability for all agents.',
      parameters: {
        type: 'object',
        properties: {},
      },
      requiredPermissions: ['WORKLOAD_VIEW'],
      isDraftOnly: false,
    },

    // ── Client & Delivery tools ──────────────────────────────────────────────
    {
      name: 'get_client_overview',
      description: 'Get an overview of a client organization including members, active tickets, and projects.',
      parameters: {
        type: 'object',
        properties: {
          organizationId: {
            type: 'string',
            description: 'Organization / tenant ID (optional, defaults to current tenant)',
          },
        },
      },
      requiredPermissions: ['MEMBER_VIEW'],
      isDraftOnly: false,
    },
    {
      name: 'get_releases',
      description: 'Get delivery board items and release status.',
      parameters: {
        type: 'object',
        properties: {
          quarter: {
            type: 'string',
            description: 'Quarter filter, e.g., Q1-2025',
          },
          status: {
            type: 'string',
            description: 'Status filter',
          },
        },
      },
      requiredPermissions: ['DELIVERY_VIEW'],
      isDraftOnly: false,
    },
    {
      name: 'get_onboarding_summary',
      description: 'Get onboarding health, blockers, and pending tasks for the tenant.',
      parameters: {
        type: 'object',
        properties: {
          tenantId: {
            type: 'string',
            description: 'Tenant ID (optional, defaults to current)',
          },
        },
      },
      requiredPermissions: ['ONBOARDING_VIEW'],
      isDraftOnly: false,
    },

    // ── Draft-only write tools ───────────────────────────────────────────────
    {
      name: 'update_ticket_status',
      description: 'Propose a status change for a ticket. Requires user confirmation before applying.',
      parameters: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'string',
            description: 'Ticket ID or ticket number',
          },
          status: {
            type: 'string',
            description: 'Target status: OPEN, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CLOSED, PENDING, ESCALATED',
          },
          reason: {
            type: 'string',
            description: 'Reason for the status change',
          },
        },
        required: ['ticketId', 'status'],
      },
      requiredPermissions: ['TICKET_STATUS_CHANGE', 'AI_COPILOT_WRITE'],
      isDraftOnly: true,
    },
    {
      name: 'assign_ticket',
      description: 'Propose assigning a ticket to a specific agent. Requires user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'string',
            description: 'Ticket ID or ticket number',
          },
          assigneeId: {
            type: 'string',
            description: 'User ID of the agent to assign',
          },
          reason: {
            type: 'string',
            description: 'Reason for assignment',
          },
        },
        required: ['ticketId', 'assigneeId'],
      },
      requiredPermissions: ['TICKET_ASSIGN', 'AI_COPILOT_WRITE'],
      isDraftOnly: true,
    },
    {
      name: 'add_ticket_comment',
      description: 'Propose adding a comment to a ticket. Requires user confirmation before posting.',
      parameters: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'string',
            description: 'Ticket ID or ticket number',
          },
          content: {
            type: 'string',
            description: 'Comment text (markdown supported)',
          },
          isInternal: {
            type: 'boolean',
            description: 'Whether this is an internal note (agents only)',
          },
        },
        required: ['ticketId', 'content'],
      },
      requiredPermissions: ['COMMENT_CREATE', 'AI_COPILOT_WRITE'],
      isDraftOnly: true,
    },
    {
      name: 'escalate_ticket',
      description: 'Propose escalating a ticket. Requires user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'string',
            description: 'Ticket ID or ticket number',
          },
          reason: {
            type: 'string',
            description: 'Escalation reason',
          },
        },
        required: ['ticketId'],
      },
      requiredPermissions: ['ESCALATION_CONFIGURE', 'AI_COPILOT_WRITE'],
      isDraftOnly: true,
    },
    {
      name: 'create_ticket',
      description: 'Propose creating a new ticket. Requires user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Ticket title',
          },
          description: {
            type: 'string',
            description: 'Ticket description',
          },
          priority: {
            type: 'string',
            description: 'Priority: LOW, MEDIUM, HIGH, URGENT',
          },
          category: {
            type: 'string',
            description: 'Category: INCIDENT, BUG, FEATURE_REQUEST, QUESTION, SUPPORT, BILLING, TASK',
          },
        },
        required: ['title', 'description'],
      },
      requiredPermissions: ['TICKET_CREATE', 'AI_COPILOT_WRITE'],
      isDraftOnly: true,
    },

    // ── AI & Analytics tools ─────────────────────────────────────────────────
    {
      name: 'get_digest',
      description: 'Get a daily/weekly digest of at-risk tickets, SLA breaches, stalled tickets, and category patterns.',
      parameters: {
        type: 'object',
        properties: {},
      },
      requiredPermissions: ['AI_DIGEST'],
      isDraftOnly: false,
    },
    {
      name: 'get_similar_tickets',
      description: 'Find resolved or closed tickets with similar title and description keywords.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Ticket title to match against',
          },
          description: {
            type: 'string',
            description: 'Ticket description to match against',
          },
        },
        required: ['title'],
      },
      requiredPermissions: ['TICKET_VIEW_OWN', 'TICKET_VIEW_ORG', 'TICKET_VIEW_ALL'],
      isDraftOnly: false,
    },
    {
      name: 'get_routing_suggestion',
      description: 'Get AI-powered agent routing suggestions for a ticket based on skills, availability, and history.',
      parameters: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'string',
            description: 'Ticket ID or ticket number',
          },
        },
        required: ['ticketId'],
      },
      requiredPermissions: ['TICKET_ASSIGN'],
      isDraftOnly: false,
    },
    {
      name: 'draft_reply',
      description: 'Generate a draft reply for a ticket using AI. Returns the suggested text for the user to review.',
      parameters: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'string',
            description: 'Ticket ID or ticket number',
          },
          tone: {
            type: 'string',
            description: 'Tone: professional, friendly, empathetic, technical',
          },
        },
        required: ['ticketId'],
      },
      requiredPermissions: ['AI_SUGGEST'],
      isDraftOnly: false,
    },
    {
      name: 'get_team_availability',
      description: 'Get current team availability including agent workloads, assigned ticket counts, and online status.',
      parameters: {
        type: 'object',
        properties: {},
      },
      requiredPermissions: ['WORKLOAD_VIEW'],
      isDraftOnly: false,
    },
    {
      name: 'get_analytics_summary',
      description: 'Get high-level analytics: tickets today/week/month, average resolution time, SLA compliance, and open ticket breakdown.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            description: 'Period: today, week, month',
          },
        },
      },
      requiredPermissions: ['REPORT_VIEW'],
      isDraftOnly: false,
    },

    // ── Advanced write tools ─────────────────────────────────────────────────
    {
      name: 'merge_tickets',
      description: 'Propose merging a secondary ticket into a primary ticket. Comments are copied and the secondary is closed.',
      parameters: {
        type: 'object',
        properties: {
          primaryTicketId: {
            type: 'string',
            description: 'Primary ticket ID or number (the one to keep)',
          },
          secondaryTicketId: {
            type: 'string',
            description: 'Secondary ticket ID or number (the one to merge and close)',
          },
        },
        required: ['primaryTicketId', 'secondaryTicketId'],
      },
      requiredPermissions: ['TICKET_DELETE', 'AI_COPILOT_WRITE'],
      isDraftOnly: true,
    },
    {
      name: 'link_tickets',
      description: 'Propose linking two tickets together so they reference each other.',
      parameters: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'string',
            description: 'First ticket ID or number',
          },
          linkedTicketId: {
            type: 'string',
            description: 'Second ticket ID or number to link',
          },
        },
        required: ['ticketId', 'linkedTicketId'],
      },
      requiredPermissions: ['TICKET_EDIT', 'AI_COPILOT_WRITE'],
      isDraftOnly: true,
    },
    {
      name: 'generate_kb_draft',
      description: 'Propose generating a knowledge base article draft from a resolved ticket.',
      parameters: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'string',
            description: 'Ticket ID or number to use as source',
          },
        },
        required: ['ticketId'],
      },
      requiredPermissions: ['KB_MANAGE', 'AI_COPILOT_WRITE'],
      isDraftOnly: true,
    },
    {
      name: 'schedule_reminder',
      description: 'Propose scheduling a personal reminder.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Reminder text',
          },
          when: {
            type: 'string',
            description: 'When to remind: e.g., "tomorrow", "in 2 hours", "2025-05-01T09:00:00Z"',
          },
        },
        required: ['text', 'when'],
      },
      requiredPermissions: ['AI_COPILOT_WRITE'],
      isDraftOnly: true,
    },
  ];

  getAllTools(): ToolDefinition[] {
    return this.tools;
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.find(t => t.name === name);
  }

  /**
   * Filter tools by user's permissions.
   * A tool is included if the user has AT LEAST ONE of its required permissions.
   * This is because some tools have overlapping view scopes (e.g., TICKET_VIEW_OWN vs TICKET_VIEW_ALL).
   */
  getToolsForUser(permissions: string[]): ToolDefinition[] {
    return this.tools.filter(tool =>
      tool.requiredPermissions.some(p => permissions.includes(p)),
    );
  }
}

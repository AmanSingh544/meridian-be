export interface ConversationContext {
  page?: string;
  entityType?: 'ticket' | 'project' | 'user' | 'kb_article' | 'delivery_item' | 'onboarding_item';
  entityId?: string;
  entity_type?: 'ticket' | 'project' | 'user' | 'kb_article' | 'delivery_item' | 'onboarding_item';
  entity_id?: string;
}

export interface CopilotMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolCalls?: unknown;
  toolCallId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

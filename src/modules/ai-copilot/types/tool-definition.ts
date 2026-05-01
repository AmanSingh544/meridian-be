// Permission is a string enum; we use string literals until Prisma client regenerates
export type PermissionString = string;

export interface ToolParameter {
  type: string;
  properties: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
  }>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter;
  requiredPermissions: PermissionString[];
  /** If true, the tool returns a draft proposal instead of executing directly. */
  isDraftOnly: boolean;
}

export interface ToolHandlerContext {
  userId: string;
  tenantId: string;
  role: string;
  permissions: string[];
  email: string;
}

export interface DraftAction {
  type: 'draft';
  tool: string;
  displayTitle: string;
  displayDescription: string;
  payload: Record<string, unknown>;
  confirmationLabel: string;
  cancelLabel: string;
}

export interface ToolResult {
  type: 'result' | 'draft' | 'error';
  data: unknown;
  message?: string;
}

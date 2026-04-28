import { ApiProperty } from '@nestjs/swagger';

export class TicketUserDto {
  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'Alex', nullable: true })
  first_name: string | null;

  @ApiProperty({ example: 'Morgan', nullable: true })
  last_name: string | null;

  @ApiProperty({ example: 'alex.morgan@3sc.com' })
  email: string;

  @ApiProperty({ example: 'https://cdn.example.com/avatars/alex.png', nullable: true })
  avatar_url: string | null;
}

export class TicketAttachmentDto {
  @ApiProperty({ example: 'att_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'saml_error_log.txt' })
  filename: string;

  @ApiProperty({ example: 'text/plain', nullable: true })
  mime_type: string | null;

  @ApiProperty({ example: 14200, nullable: true })
  size_bytes: number | null;

  @ApiProperty({ example: 'uploads/abc123/saml_error_log.txt' })
  storage_key: string;

  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M', nullable: true })
  uploaded_by: string | null;

  @ApiProperty({ example: '2026-04-12T09:15:00Z' })
  created_at: string;
}

export class TicketCommentAuthorDto {
  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'Sarah', nullable: true })
  first_name: string | null;

  @ApiProperty({ example: 'Thompson', nullable: true })
  last_name: string | null;

  @ApiProperty({ example: 'https://cdn.example.com/avatars/sarah.png', nullable: true })
  avatar_url: string | null;
}

export class TicketCommentDto {
  @ApiProperty({ example: 'cmt_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'This is a comment body.' })
  body: string;

  @ApiProperty({ example: false })
  is_internal: boolean;

  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M', nullable: true })
  author_id: string | null;

  @ApiProperty({ type: TicketCommentAuthorDto, nullable: true })
  author?: TicketCommentAuthorDto;

  @ApiProperty({ example: '2026-04-12T09:20:00Z' })
  created_at: string;

  @ApiProperty({ example: '2026-04-12T09:20:00Z' })
  updated_at: string;
}

export class TicketCountDto {
  @ApiProperty({ example: 5 })
  comments: number;
}

export class TicketDto {
  @ApiProperty({ example: 'tkt_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'TKT-C001' })
  ticket_number: string;

  @ApiProperty({ example: 'SSO login broken after Azure AD certificate renewal' })
  title: string;

  @ApiProperty({ example: 'Full description text...', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'IN_PROGRESS' })
  status: string;

  @ApiProperty({ example: 'CRITICAL' })
  priority: string;

  @ApiProperty({ example: 'INCIDENT', nullable: true })
  category: string | null;

  @ApiProperty({ example: ['sso', 'azure-ad', 'saml'], type: [String] })
  tags: string[];

  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M', nullable: true })
  requester_id: string | null;

  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M', nullable: true })
  assignee_id: string | null;

  @ApiProperty({ example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  tenant_id: string;

  @ApiProperty({ example: 'proj_01HZX8K7YV7QNSQJQ5ZQFJ9K3M', nullable: true })
  project_id: string | null;

  @ApiProperty({ example: '2026-04-12T09:00:00Z' })
  created_at: string;

  @ApiProperty({ example: '2026-04-16T07:45:00Z' })
  updated_at: string;

  @ApiProperty({ example: '2026-04-16T08:00:00Z', nullable: true })
  resolved_at: string | null;

  @ApiProperty({ example: null, nullable: true })
  closed_at: string | null;

  @ApiProperty({ type: TicketUserDto, nullable: true })
  requester?: TicketUserDto;

  @ApiProperty({ type: TicketUserDto, nullable: true })
  assignee?: TicketUserDto;

  @ApiProperty({ type: TicketCountDto, nullable: true })
  _count?: TicketCountDto;

  @ApiProperty({ type: [TicketCommentDto], nullable: true })
  comments?: TicketCommentDto[];

  @ApiProperty({ type: [TicketAttachmentDto], nullable: true })
  attachments?: TicketAttachmentDto[];
}

export class PaginatedMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 25 })
  limit: number;

  @ApiProperty({ example: 47 })
  total: number;

  @ApiProperty({ example: 2 })
  total_pages: number;
}

export class PaginatedTicketResponseDto {
  @ApiProperty({ type: [TicketDto] })
  data: TicketDto[];

  @ApiProperty({ type: PaginatedMetaDto })
  meta: PaginatedMetaDto;
}

export class SingleTicketResponseDto {
  @ApiProperty({ type: TicketDto })
  data: TicketDto;
}

export class TicketDeleteResponseDto {
  @ApiProperty({ example: 'Ticket deleted successfully' })
  message: string;
}

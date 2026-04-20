import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CommentAuthorDto {
  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'Sarah', nullable: true })
  first_name: string | null;

  @ApiProperty({ example: 'Thompson', nullable: true })
  last_name: string | null;

  @ApiProperty({ example: 'sarah@acmecorp.com' })
  email: string;

  @ApiProperty({ example: 'https://cdn.example.com/avatars/sarah.png', nullable: true })
  avatar_url: string | null;

  @ApiProperty({ example: 'AGENT' })
  role: string;
}

export class CommentAttachmentDto {
  @ApiProperty({ example: 'att_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'error_log.txt' })
  filename: string;

  @ApiProperty({ example: 'text/plain', nullable: true })
  mime_type: string | null;

  @ApiProperty({ example: 14200, nullable: true })
  size_bytes: number | null;

  @ApiProperty({ example: 'uploads/abc123/error_log.txt' })
  storage_key: string;

  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M', nullable: true })
  uploaded_by: string | null;

  @ApiProperty({ example: '2026-04-12T09:15:00Z' })
  created_at: string;
}

export class CommentReplyDto {
  @ApiProperty({ example: 'cmt_01HZX8K7YV7QNSQJQ5ZQFJ9K4N' })
  id: string;

  @ApiProperty({ example: 'Thanks for the update!' })
  body: string;

  @ApiProperty({ example: false })
  is_internal: boolean;

  @ApiProperty({ type: CommentAuthorDto, nullable: true })
  author: CommentAuthorDto | null;

  @ApiProperty({ example: '2026-04-12T10:00:00Z' })
  created_at: string;

  @ApiProperty({ example: '2026-04-12T10:00:00Z' })
  updated_at: string;
}

export class CommentDto {
  @ApiProperty({ example: 'cmt_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'tkt_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  ticket_id: string;

  @ApiProperty({ example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  tenant_id: string;

  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M', nullable: true })
  author_id: string | null;

  @ApiProperty({ example: 'Comment content here.' })
  body: string;

  @ApiProperty({ example: false })
  is_internal: boolean;

  @ApiProperty({ example: false })
  is_deleted: boolean;

  @ApiProperty({ example: 'cmt_01HZX8K7YV7QNSQJQ5ZQFJ9K2L', nullable: true })
  parent_id: string | null;

  @ApiProperty({ type: [CommentAttachmentDto] })
  attachments: CommentAttachmentDto[];

  @ApiProperty({ example: ['usr_01HZX8K7YV7QNSQJQ5ZQFJ9K4N'], type: [String] })
  mentions: string[];

  @ApiProperty({ type: CommentAuthorDto, nullable: true })
  author: CommentAuthorDto | null;

  @ApiProperty({ type: [CommentReplyDto] })
  replies: CommentReplyDto[];

  @ApiProperty({ example: '2026-04-12T09:20:00Z' })
  created_at: string;

  @ApiProperty({ example: '2026-04-12T09:20:00Z' })
  updated_at: string;
}

export class CommentsListResponseDto {
  @ApiProperty({ type: [CommentDto] })
  data: CommentDto[];
}

export class SingleCommentResponseDto {
  @ApiProperty({ type: CommentDto })
  data: CommentDto;
}

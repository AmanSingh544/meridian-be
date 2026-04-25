import { IsString, IsOptional, IsBoolean, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ description: 'Ticket ID', example: 'tk_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @IsUUID()
  @IsOptional()
  ticket_id?: string;

  @ApiPropertyOptional({ description: 'Ticket ID (camelCase alias)', example: 'tk_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @IsUUID()
  @IsOptional()
  ticketId?: string;

  @ApiProperty({ description: 'Comment body text', example: 'I have checked the logs and the SAML certificate expired on 12 Apr.' })
  @IsString()
  @IsOptional()
  body?: string;

  @ApiPropertyOptional({ description: 'Comment body (message alias)', example: 'Hello, any update on this?' })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({ description: 'Comment body (content alias)', example: 'Hello, any update on this?' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ description: 'Whether this is an internal note (agent-only visibility)', example: false, default: false })
  @IsOptional()
  @IsBoolean()
  is_internal?: boolean;

  @ApiPropertyOptional({ description: 'Whether this is an internal note (camelCase alias)', example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;

  @ApiPropertyOptional({ description: 'Parent comment ID for threaded replies', example: 'cmt_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @IsOptional()
  @IsString()
  parent_id?: string;

  @ApiPropertyOptional({ description: 'Parent comment ID (camelCase alias)', example: 'cmt_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ description: 'User IDs mentioned in the comment (for notifications)', example: ['usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentioned_user_ids?: string[];

  @ApiPropertyOptional({ description: 'Attachment IDs to link to this comment', example: ['att_01HZX8K7YV7QNSQJQ5ZQFJ9K3M'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachment_ids?: string[];
}

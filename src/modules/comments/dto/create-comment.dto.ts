import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Comment body text',
    example: 'I have checked the logs and the SAML certificate expired on 12 Apr.',
  })
  @IsString()
  body: string;

  @ApiPropertyOptional({
    description: 'Whether this is an internal note (agent-only visibility)',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_internal?: boolean;

  @ApiPropertyOptional({
    description: 'Parent comment ID for threaded replies',
    example: 'cmt_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @IsOptional()
  @IsString()
  parent_id?: string;

  @ApiPropertyOptional({
    description: 'User IDs mentioned in the comment (for notifications)',
    example: ['usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];
}

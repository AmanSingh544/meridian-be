import { IsString, IsOptional, IsBoolean, IsArray, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateKbArticleDto {
  @ApiProperty({ example: 'How to configure Azure AD SAML SSO' })
  @IsString()
  title: string;

  @ApiProperty({ example: '# Full markdown content...' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ example: 'KBC-001' })
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiPropertyOptional({ example: ['sso', 'azure-ad'], type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_published?: boolean;
}

export class UpdateKbArticleDto {
  @ApiPropertyOptional({ example: 'Updated title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Updated content...' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ example: 'KBC-002' })
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiPropertyOptional({ example: ['sso'], type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_published?: boolean;
}

export class KbSearchQueryDto {
  @ApiProperty({ example: 'azure sso' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  limit?: number;
}

export class KbArticleResponseDto {
  @ApiProperty({ example: 'kb_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'How to configure Azure AD SAML SSO' })
  title: string;

  @ApiProperty({ example: '# Full markdown content...' })
  content: string;

  @ApiProperty({ example: 'azure-ad-saml-sso' })
  slug: string;

  @ApiProperty({ example: 'kbc_01HZX8K7YV7QNSQJQ5ZQFJ9K3M', nullable: true })
  category_id: string | null;

  @ApiProperty({ example: ['sso', 'azure-ad'], type: [String] })
  tags: string[];

  @ApiProperty({ example: true })
  is_published: boolean;

  @ApiProperty({ example: 428 })
  view_count: number;

  @ApiProperty({ example: 312 })
  helpful_count: number;

  @ApiProperty({ example: '2025-06-01T00:00:00Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-15T00:00:00Z' })
  updated_at: string;
}

export class KbCategoryResponseDto {
  @ApiProperty({ example: 'kbc_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'Authentication & SSO' })
  name: string;

  @ApiProperty({ example: 'auth-sso' })
  slug: string;

  @ApiProperty({ example: 3 })
  article_count: number;
}

export class KbSearchResultDto {
  @ApiProperty({ type: KbArticleResponseDto })
  article: KbArticleResponseDto;

  @ApiProperty({ example: 0.92 })
  score: number;

  @ApiProperty({ example: ['Step-by-step guide for configuring <b>Azure AD SAML SSO</b>...'], type: [String] })
  highlights: string[];
}

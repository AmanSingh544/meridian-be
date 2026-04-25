import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateKbArticleDto {
  @ApiProperty({ example: 'How to configure Azure AD SAML SSO' })
  @IsString()
  title: string;

  @ApiProperty({ example: '# Full markdown content...' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ example: 'Step-by-step guide for configuring Azure AD SAML SSO...' })
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional({ example: 'auth-sso' })
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

  @ApiPropertyOptional({ example: 'published', enum: ['draft', 'published', 'archived'] })
  @IsOptional()
  @IsString()
  status?: string;
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

  @ApiPropertyOptional({ example: 'Updated excerpt...' })
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional({ example: 'auth-sso' })
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

  @ApiPropertyOptional({ example: 'published', enum: ['draft', 'published', 'archived'] })
  @IsOptional()
  @IsString()
  status?: string;
}

// ── Response DTOs (match KBArticle / KBCategory / KBSearchResult frontend types) ──

export class KbArticleResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  id: string;

  @ApiProperty({ example: 'How to configure Azure AD SAML SSO' })
  title: string;

  @ApiProperty({ example: '# Full markdown content...' })
  content: string;

  @ApiProperty({ example: 'Step-by-step guide for configuring Azure AD SAML SSO...' })
  excerpt: string;

  @ApiProperty({ example: 'how-to-configure-azure-ad-saml-sso' })
  slug: string;

  @ApiProperty({ example: 'auth-sso', nullable: true })
  categoryId: string | null;

  @ApiProperty({ example: ['sso', 'azure-ad'], type: [String] })
  tags: string[];

  @ApiProperty({ example: null, nullable: true })
  authorId: string | null;

  @ApiProperty({ example: true })
  isPublished: boolean;

  @ApiProperty({ example: 428 })
  viewCount: number;

  @ApiProperty({ example: 312 })
  helpfulCount: number;

  @ApiProperty({ example: [], type: [String] })
  relatedArticleIds: string[];

  @ApiProperty({ example: '2025-06-01T00:00:00Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-15T00:00:00Z' })
  updated_at: string;
}

export class KbCategoryResponseDto {
  @ApiProperty({ example: 'auth-sso' })
  id: string;

  @ApiProperty({ example: 'auth-sso' })
  name: string;

  @ApiProperty({ example: 'auth-sso' })
  slug: string;

  @ApiProperty({ example: 3 })
  articleCount: number;
}

export class KbSearchResultDto {
  @ApiProperty({ type: KbArticleResponseDto })
  article: KbArticleResponseDto;

  @ApiProperty({ example: 0.92 })
  score: number;

  @ApiProperty({ example: ['Step-by-step guide for configuring <b>Azure AD SAML SSO</b>...'], type: [String] })
  highlights: string[];
}

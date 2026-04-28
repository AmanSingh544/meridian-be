import { IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({
    description: 'Organization display name',
    example: 'Acme Corp',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'URL-friendly slug',
    example: 'acme-corp',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description: 'Subscription plan',
    example: 'premium',
  })
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional({
    description: 'Organization settings (JSON object)',
    example: { timezone: 'America/New_York', language: 'en' },
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Branding configuration (JSON object)',
    example: { primaryColor: '#6366f1', logoUrl: 'https://cdn.example.com/logo.png' },
  })
  @IsOptional()
  @IsObject()
  branding?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Whether the organization is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

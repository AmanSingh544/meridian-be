import { IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() email_on_ticket_created?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() email_on_ticket_status_changed?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() email_on_ticket_assigned?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() email_on_comment_added?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() email_on_sla_breach?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() slack_integration_enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() slack_channel?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() daily_digest_enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() daily_digest_time?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() client_status_notifications?: boolean;
}

export class UpdateAIFeatureSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() triage_agent_enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() similar_ticket_suggestions_enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() kb_deflection_enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() auto_generate_kb_articles_enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() weekly_project_summaries_enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() ai_provider?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ai_model_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ai_base_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ai_api_key?: string; // actual key to set
  @ApiPropertyOptional() @IsOptional() @IsBoolean() ai_api_key_set?: boolean; // read-only flag, ignored on write
}

export class UpdateAccessSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() sso_enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() two_factor_required?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() audit_logging_enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() ip_allowlist_enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() ip_allowlist?: string[];
}

export class UpdateSystemSettingsDto {
  @ApiPropertyOptional({ type: UpdateNotificationSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateNotificationSettingsDto)
  notifications?: UpdateNotificationSettingsDto;

  @ApiPropertyOptional({ type: UpdateAIFeatureSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAIFeatureSettingsDto)
  ai_features?: UpdateAIFeatureSettingsDto;

  @ApiPropertyOptional({ type: UpdateAccessSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAccessSettingsDto)
  access?: UpdateAccessSettingsDto;
}

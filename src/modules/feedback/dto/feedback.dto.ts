import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail, IsString, IsOptional, IsArray, IsInt, IsUUID,
  Min, Max, IsIn, IsNotEmpty,
} from 'class-validator';

// ─── Token management ────────────────────────────────────────────────────────

export class CreateSurveyTokenDto {
  @ApiProperty({ example: 'customer@acme.com' })
  @IsEmail()
  customer_email: string;

  @ApiPropertyOptional({ example: 'Jane Smith' })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiPropertyOptional({ example: 'Acme Corp' })
  @IsOptional()
  @IsString()
  company_name?: string;
}

// ─── Survey submission ────────────────────────────────────────────────────────

export class SubmitSurveyDto {
  @ApiProperty()
  @IsUUID()
  token: string;

  // Step 1 – Modules
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  selected_modules: string[];

  // Step 2 – Overall satisfaction
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) csat_score?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) overall_value?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() expectation_met?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() overall_comment?: string;

  // Step 3 – Product quality
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) ease_of_use?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) feature_coverage?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) ai_ml_quality?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) customization?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) performance?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) ibp_accuracy?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) itms_quality?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) wms_quality?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) carbonx_quality?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() top_feature?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() product_comment?: string;

  // Step 4 – Implementation
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) impl_smoothness?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) training_quality?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() impl_timeline?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() time_to_value?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) integration_quality?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() impl_comment?: string;

  // Step 5 – Support & account
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) support_responsiveness?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) support_quality?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) account_mgmt?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) proactive_comm?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() preferred_channel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() support_comment?: string;

  // Step 6 – Business value & NPS
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) visibility_improvement?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() kpi_improvement?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) roi_satisfaction?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() renew_intent?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10) nps_score?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() recommend_reason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() open_feedback?: string;
}

// ─── Analytics DTOs ────────────────────────────────────────────────────────────

export class FeedbackKpiDto {
  @ApiProperty({ example: 4.3 }) avgCsat: number;
  @ApiProperty({ example: 68 }) npsScore: number;
  @ApiProperty({ example: 456 }) totalResponses: number;
  @ApiProperty({ example: 82 }) responseRate: number;
  @ApiProperty({ example: 76 }) positiveSentiment: number;
  @ApiProperty({ example: 14 }) flaggedIssues: number;
}

export class CsatTrendDataDto {
  @ApiProperty({ example: '2026-04-14' }) date: string;
  @ApiProperty({ example: 4.3 }) csat: number;
  @ApiProperty({ example: 69 }) nps: number;
}

export class NpsBreakdownDto {
  @ApiProperty({ example: 48 }) promoters: number;
  @ApiProperty({ example: 32 }) passives: number;
  @ApiProperty({ example: 20 }) detractors: number;
}

export class FeedbackThemeDto {
  @ApiProperty({ example: 'Dashboard loading slow' }) theme: string;
  @ApiProperty({ example: 34 }) count: number;
  @ApiProperty({ example: 'negative' }) sentiment: string;
}

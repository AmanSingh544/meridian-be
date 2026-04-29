import { IsString, IsOptional, IsArray, ValidateNested, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Task DTOs ─────────────────────────────────────────────────────────────────

export class UpdateOnboardingTaskDto {
  @ApiPropertyOptional({ example: 'DONE', enum: ['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'All deliverables reviewed and approved.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOnboardingTaskDto {
  @ApiProperty({ example: 'DNS cutover' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Update DNS records to point to Meridian portal.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'DELIVERY', enum: ['CLIENT', 'DELIVERY'], default: 'DELIVERY' })
  @IsOptional()
  @IsEnum(['CLIENT', 'DELIVERY'])
  owner?: 'CLIENT' | 'DELIVERY';

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  due_date?: string;
}

// ── Project DTOs ──────────────────────────────────────────────────────────────

export class CreateOnboardingProjectDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', description: 'Tenant/Organisation ID' })
  @IsString()
  organization_id: string;

  @ApiPropertyOptional({ example: '2026-07-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  go_live_date?: string;

  @ApiPropertyOptional({ example: 'IN_PROGRESS', enum: ['IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'] })
  @IsOptional()
  @IsEnum(['IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'])
  status?: string;

  @ApiPropertyOptional({ type: [CreateOnboardingTaskDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOnboardingTaskDto)
  tasks?: CreateOnboardingTaskDto[];
}

export class UpdateOnboardingProjectDto {
  @ApiPropertyOptional({ example: '2026-07-15T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  go_live_date?: string;

  @ApiPropertyOptional({ example: 'ON_HOLD', enum: ['IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'] })
  @IsOptional()
  @IsEnum(['IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'])
  status?: string;
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class OnboardingTaskDto {
  @ApiProperty({ example: '339b6200-6a9c-408d-b58f-454284001c86' })
  id: string;

  @ApiProperty({ example: 'DNS cutover' })
  title: string;

  @ApiProperty({ example: 'Update DNS records to point to Meridian portal.', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'DELIVERY', enum: ['CLIENT', 'DELIVERY'] })
  owner: string;

  @ApiProperty({ example: '2026-05-28T00:00:00.000Z', nullable: true })
  dueDate: string | null;

  @ApiProperty({ example: 'PENDING', enum: ['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED'] })
  status: string;

  @ApiPropertyOptional({ example: '2026-04-15T00:00:00.000Z' })
  completedAt?: string;
}

export class OnboardingPhaseDto {
  @ApiProperty({ example: 'PH-MY-1' })
  id: string;

  @ApiProperty({ example: 1 })
  phaseNumber: number;

  @ApiProperty({ example: 'Go-Live' })
  name: string;

  @ApiProperty({ example: 0 })
  progress: number;

  @ApiProperty({ example: 'PENDING', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] })
  status: string;

  @ApiProperty({ type: [OnboardingTaskDto] })
  tasks: OnboardingTaskDto[];
}

export class OnboardingProjectDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id: string;

  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  organizationId: string;

  @ApiProperty({ example: 'Acme Corp' })
  organizationName: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  leadAgentId: string | null;

  @ApiProperty({ example: '3SC Team' })
  leadAgentName: string;

  @ApiProperty({ example: 'IN_PROGRESS', enum: ['IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'] })
  status: string;

  @ApiProperty({ example: 'ON_TRACK', enum: ['ON_TRACK', 'AT_RISK', 'BLOCKED'] })
  health: string;

  @ApiProperty({ example: 40 })
  overallProgress: number;

  @ApiProperty({ example: '2026-05-24T00:00:00.000Z' })
  goLiveDate: string;

  @ApiProperty({ example: 0 })
  blockerCount: number;

  @ApiProperty({ type: [OnboardingPhaseDto] })
  phases: OnboardingPhaseDto[];

  @ApiProperty({ example: '2026-04-15T00:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-04-15T00:00:00.000Z' })
  updated_at: string;
}

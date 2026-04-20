import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOnboardingTaskDto {
  @ApiPropertyOptional({ example: 'completed' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'All deliverables reviewed and approved.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class OnboardingTaskDto {
  @ApiProperty({ example: 'task_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'Initial Setup' })
  title: string;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiProperty({ example: '2026-04-20T00:00:00Z', nullable: true })
  due_date: string | null;

  @ApiProperty({ example: '2026-04-16T10:00:00Z' })
  created_at: string;
}

export class OnboardingProjectDto {
  @ApiProperty({ example: 'onb_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'Acme Corp Onboarding' })
  title: string;

  @ApiProperty({ example: 'Standard onboarding track', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty({ type: [OnboardingTaskDto] })
  tasks: OnboardingTaskDto[];

  @ApiProperty({ example: '2026-04-16T10:00:00Z' })
  created_at: string;

  @ApiProperty({ example: '2026-04-16T10:00:00Z' })
  updated_at: string;
}

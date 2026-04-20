import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BudgetTier {
  ECONOMY = 'economy',
  STANDARD = 'standard',
  PREMIUM = 'premium',
}

export class ClassifyDto {
  @ApiProperty({
    description: 'Ticket title',
    example: 'SSO login broken after Azure AD certificate renewal',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Ticket description',
    example: 'Users are unable to log in via SSO since this morning...',
  })
  @IsString()
  description: string;

  @ApiPropertyOptional({
    description: 'Budget tier for AI provider selection',
    enum: BudgetTier,
    example: BudgetTier.STANDARD,
  })
  @IsOptional()
  @IsEnum(BudgetTier)
  budget_tier?: BudgetTier;
}

export class SummarizeDto {
  @ApiProperty({
    description: 'Ticket content to summarize',
    example: 'Full ticket description and comment thread...',
  })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    description: 'Budget tier for AI provider selection',
    enum: BudgetTier,
    example: BudgetTier.STANDARD,
  })
  @IsOptional()
  @IsEnum(BudgetTier)
  budget_tier?: BudgetTier;
}

export class ReplyDto {
  @ApiProperty({
    description: 'Current ticket content (title + description + comments)',
    example: 'Customer is asking about refund policy...',
  })
  @IsString()
  ticket_content: string;

  @ApiPropertyOptional({
    description: 'Additional context from knowledge base or previous tickets',
    example: 'Our refund policy allows returns within 30 days...',
  })
  @IsOptional()
  @IsString()
  context?: string;

  @ApiPropertyOptional({
    description: 'Desired tone of the reply',
    example: 'professional',
    default: 'professional',
  })
  @IsOptional()
  @IsString()
  tone?: string;

  @ApiPropertyOptional({
    description: 'Budget tier for AI provider selection',
    enum: BudgetTier,
    example: BudgetTier.STANDARD,
  })
  @IsOptional()
  @IsEnum(BudgetTier)
  budget_tier?: BudgetTier;
}

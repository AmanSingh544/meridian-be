import { ApiProperty } from '@nestjs/swagger';

export class ClassificationResponseDto {
  @ApiProperty({
    description: 'Suggested ticket category',
    example: 'technical_support',
  })
  category: string;

  @ApiProperty({
    description: 'Suggested priority level',
    example: 'high',
  })
  priority: string;

  @ApiProperty({
    description: 'Model confidence score (0.0 – 1.0)',
    example: 0.92,
  })
  confidence: number;
}

export class SummaryResponseDto {
  @ApiProperty({
    description: 'Generated summary text',
    example: 'Customer reports SSO login failure after Azure AD certificate renewal. Affecting all users since 09:00 UTC.',
  })
  summary: string;

  @ApiProperty({
    description: 'AI provider used for generation',
    example: 'openai-gpt4o',
  })
  provider: string;
}

export class ReplyResponseDto {
  @ApiProperty({
    description: 'Generated reply text',
    example: 'Thank you for reporting this. We are investigating the SSO issue...',
  })
  reply: string;

  @ApiProperty({
    description: 'AI provider used for generation',
    example: 'openai-gpt4o-mini',
  })
  provider: string;
}

export class ProviderStatusDto {
  @ApiProperty({ example: 'openai-gpt4o' })
  name: string;

  @ApiProperty({ example: 'gpt-4o' })
  model: string;

  @ApiProperty({ example: true })
  available: boolean;

  @ApiProperty({ example: 0.005 })
  costPer1kTokens: number;

  @ApiProperty({ example: 95 })
  qualityScore: number;
}

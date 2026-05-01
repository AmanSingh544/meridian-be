import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FeedbackKpiDto {
  @ApiProperty({ example: 4.3 })
  avgCsat: number;

  @ApiProperty({ example: 68 })
  npsScore: number;

  @ApiProperty({ example: 456 })
  totalResponses: number;

  @ApiProperty({ example: 82 })
  responseRate: number;

  @ApiProperty({ example: 76 })
  positiveSentiment: number;

  @ApiProperty({ example: 14 })
  flaggedIssues: number;
}

export class CsatTrendDataDto {
  @ApiProperty({ example: '2026-04-14' })
  date: string;

  @ApiProperty({ example: 4.3 })
  csat: number;

  @ApiProperty({ example: 69 })
  nps: number;
}

export class NpsBreakdownDto {
  @ApiProperty({ example: 48 })
  promoters: number;

  @ApiProperty({ example: 32 })
  passives: number;

  @ApiProperty({ example: 20 })
  detractors: number;
}

export class FeedbackThemeDto {
  @ApiProperty({ example: 'Dashboard loading slow' })
  theme: string;

  @ApiProperty({ example: 34 })
  count: number;

  @ApiProperty({ example: 'negative' })
  sentiment: string;
}

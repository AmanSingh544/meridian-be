import { IsString, IsUUID, IsObject, IsOptional } from 'class-validator';

export class ExecuteDraftDto {
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsString()
  tool: string;

  @IsObject()
  payload: Record<string, unknown>;
}

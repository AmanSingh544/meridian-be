import { IsString, IsUUID, IsOptional } from 'class-validator';

export class ChatMessageDto {
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsUUID()
  conversation_id?: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  contextPage?: string;

  @IsOptional()
  @IsString()
  context_page?: string;
}

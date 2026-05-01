import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AiCopilotService } from './ai-copilot.service';
import { AuthService } from '../auth/auth.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { ChatMessageDto } from './dto/chat-message.dto';
import { ExecuteDraftDto } from './dto/tool-result.dto';

@Controller('ai/copilot')
@UseGuards(JwtAuthGuard)
export class AiCopilotController {
  constructor(
    private copilotService: AiCopilotService,
    private authService: AuthService,
  ) {}

  @Post('sessions')
  async createSession(@Body() dto: CreateSessionDto, @Request() req: any) {
    const user = req.user;
    return this.copilotService.createSession(user.userId, user.tenantId, dto.context as any);
  }

  @Get('sessions')
  async listSessions(@Request() req: any, @Query('limit') limit?: string) {
    const user = req.user;
    return this.copilotService.listSessions(user.userId, user.tenantId, limit ? parseInt(limit, 10) : 20);
  }

  @Get('sessions/:id')
  async getHistory(@Param('id') id: string, @Request() req: any) {
    const user = req.user;
    return this.copilotService.getHistory(id, user.userId, user.tenantId);
  }

  @Patch('sessions/:id')
  async renameSession(
    @Param('id') id: string,
    @Body() dto: { title: string },
    @Request() req: any,
  ) {
    const user = req.user;
    await this.copilotService.getHistory(id, user.userId, user.tenantId);
    await this.copilotService.renameSession(id, dto.title);
    return { success: true };
  }

  @Delete('sessions/:id')
  async deleteSession(@Param('id') id: string, @Request() req: any) {
    const user = req.user;
    return this.copilotService.deleteSession(id, user.userId, user.tenantId);
  }

  @Post('sessions/:id/chat')
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: ChatMessageDto,
    @Request() req: any,
  ) {
    const user = req.user;
    await this.copilotService.getHistory(id, user.userId, user.tenantId);

    const fullUser = await this.authService.validateUserById(user.userId);

    return this.copilotService.sendMessage(id, dto.message, {
      userId: user.userId,
      tenantId: user.tenantId,
      role: user.role,
      permissions: fullUser.permissions,
      email: user.email,
    });
  }

  @Post('sessions/:id/execute-draft')
  async executeDraft(
    @Param('id') id: string,
    @Body() dto: ExecuteDraftDto,
    @Request() req: any,
  ) {
    const user = req.user;
    await this.copilotService.getHistory(id, user.userId, user.tenantId);

    const fullUser = await this.authService.validateUserById(user.userId);

    return this.copilotService.executeDraft(id, dto.tool, dto.payload, {
      userId: user.userId,
      tenantId: user.tenantId,
      role: user.role,
      permissions: fullUser.permissions,
      email: user.email,
    });
  }
}

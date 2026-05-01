import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AiCopilotController } from './ai-copilot.controller';
import { AiCopilotGateway } from './ai-copilot.gateway';
import { AiCopilotService } from './ai-copilot.service';
import { ToolRegistry } from './tool-registry';
import { ToolExecutor } from './tool-executor';
import { AiModule } from '../ai/ai.module';
import { TicketsModule } from '../tickets/tickets.module';
import { CommentsModule } from '../comments/comments.module';
import { AiExtendedModule } from '../ai-extended/ai-extended.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AiModule, TicketsModule, CommentsModule, AiExtendedModule, AuthModule, JwtModule],
  controllers: [AiCopilotController],
  providers: [AiCopilotService, AiCopilotGateway, ToolRegistry, ToolExecutor],
  exports: [AiCopilotService],
})
export class AiCopilotModule {}

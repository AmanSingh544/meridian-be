import { Module } from '@nestjs/common';
import { AiExtendedController } from './ai-extended.controller';
import { AiExtendedService } from './ai-extended.service';
import { AiModule } from '../ai/ai.module';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Module({
  imports: [AiModule],
  controllers: [AiExtendedController],
  providers: [AiExtendedService, PrismaService],
})
export class AiExtendedModule {}

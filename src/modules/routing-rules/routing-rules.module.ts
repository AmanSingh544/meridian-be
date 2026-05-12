import { Module } from '@nestjs/common';
import { RoutingRulesController } from './routing-rules.controller';
import { RoutingRulesService } from './routing-rules.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [RoutingRulesController],
  providers: [RoutingRulesService],
})
export class RoutingRulesModule {}

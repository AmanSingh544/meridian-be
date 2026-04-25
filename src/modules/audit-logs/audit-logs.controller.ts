import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogResponseDto } from './dto/audit-log.dto';

@ApiTags('Audit Logs')
@ApiCookieAuth('access_token')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogsController {
  constructor(private auditLogsService: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs for a tenant (paginated, filterable)' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'resource_type', required: false })
  @ApiQuery({ name: 'user_id', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  @ApiResponse({ status: 200, type: [AuditLogResponseDto] })
  findAll(
    @Query('tenant_id') tenantId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('resource_type') resource_type?: string,
    @Query('user_id') user_id?: string,
    @Query('action') action?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
  ) {
    return this.auditLogsService.findAll(tenantId, {
      page: parseInt(page),
      limit: parseInt(limit),
      resource_type,
      user_id,
      action,
      date_from,
      date_to,
    });
  }
}

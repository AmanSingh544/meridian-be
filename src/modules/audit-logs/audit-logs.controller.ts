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
  @ApiOperation({ summary: 'List audit logs' })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'page_size', required: false, example: '20' })
  @ApiQuery({ name: 'resource_type', required: false, example: 'ticket' })
  @ApiQuery({ name: 'user_id', required: false, example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiResponse({ status: 200, type: [AuditLogResponseDto] })
  findAll(
    @Query('page') page: string = '1',
    @Query('page_size') pageSize: string = '20',
    @Query('resource_type') resourceType?: string,
    @Query('user_id') userId?: string,
  ) {
    return this.auditLogsService.findAll(parseInt(page), parseInt(pageSize), resourceType, userId);
  }
}

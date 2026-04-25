import { Controller, Get, Post, Delete, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { NotificationResponseDto } from './dto/notification.dto';

@ApiTags('Notifications')
@ApiCookieAuth('access_token')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for current user' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'unread_only', required: false })
  @ApiResponse({ status: 200, type: [NotificationResponseDto] })
  findAll(
    @CurrentUser('userId') userId: string,
    @Query('tenant_id') tenantId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('unread_only') unreadOnly?: string,
  ) {
    return this.notificationsService.findAll(
      userId,
      tenantId,
      parseInt(page),
      parseInt(limit),
      unreadOnly === 'true',
    );
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200 })
  markRead(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Query('tenant_id') tenantId: string,
  ) {
    return this.notificationsService.markRead(id, userId, tenantId);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200 })
  markAllRead(
    @CurrentUser('userId') userId: string,
    @Query('tenant_id') tenantId: string,
  ) {
    return this.notificationsService.markAllRead(userId, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200 })
  remove(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Query('tenant_id') tenantId: string,
  ) {
    return this.notificationsService.remove(id, userId, tenantId);
  }
}

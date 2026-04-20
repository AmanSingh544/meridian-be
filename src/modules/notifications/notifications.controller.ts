import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
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
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'unread_only', required: false, example: 'false' })
  @ApiResponse({ status: 200, type: [NotificationResponseDto] })
  findAll(
    @CurrentUser('userId') userId: string,
    @Query('page') page: string = '1',
    @Query('unread_only') unreadOnly?: string,
  ) {
    return this.notificationsService.findAll(userId, parseInt(page), unreadOnly === 'true');
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', example: 'notif_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiResponse({ status: 200 })
  markRead(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.notificationsService.markRead(id, userId);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200 })
  markAllRead(@CurrentUser('userId') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }
}

import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';

@ApiTags('Realtime')
@ApiCookieAuth('access_token')
@Controller('realtime')
@UseGuards(JwtAuthGuard)
export class RealtimeController {
  @Get('poll')
  @ApiOperation({ summary: 'Poll for realtime events (WebSocket fallback)' })
  @ApiResponse({ status: 200 })
  poll() {
    return { data: [] };
  }
}

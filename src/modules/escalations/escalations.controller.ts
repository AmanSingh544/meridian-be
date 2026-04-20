import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { EscalationsService } from './escalations.service';
import {
  EscalationAssignDto,
  EscalationResolveDto,
  EscalationResponseDto,
  EscalationAgentDto,
} from './dto/escalation.dto';

@ApiTags('Escalations')
@ApiCookieAuth('access_token')
@Controller('escalations')
@UseGuards(JwtAuthGuard)
export class EscalationsController {
  constructor(private escalationsService: EscalationsService) {}

  @Get()
  @ApiOperation({ summary: 'List escalations' })
  @ApiResponse({ status: 200, type: [EscalationResponseDto] })
  findAll() {
    return this.escalationsService.findAll();
  }

  @Get('agents')
  @ApiOperation({ summary: 'List escalation agents' })
  @ApiResponse({ status: 200, type: [EscalationAgentDto] })
  getAgents() {
    return this.escalationsService.getAgents();
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign escalation to agent' })
  @ApiParam({ name: 'id', example: 'esc_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiBody({ type: EscalationAssignDto })
  @ApiResponse({ status: 200 })
  assign(@Param('id') id: string, @Body() dto: EscalationAssignDto) {
    return this.escalationsService.assign(id, dto);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve escalation' })
  @ApiParam({ name: 'id', example: 'esc_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiBody({ type: EscalationResolveDto })
  @ApiResponse({ status: 200 })
  resolve(@Param('id') id: string, @Body() dto: EscalationResolveDto) {
    return this.escalationsService.resolve(id, dto);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketTransitionDto } from './dto/ticket-transition.dto';
import { TicketListQueryDto } from './dto/ticket-list-query.dto';
import {
  PaginatedTicketResponseDto,
  SingleTicketResponseDto,
  TicketDeleteResponseDto,
  TicketDto,
} from './dto/ticket-response.dto';

@ApiTags('Tickets')
@ApiCookieAuth('access_token')
@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Get()
  @ApiOperation({
    summary: 'List tickets',
    description:
      'Returns a paginated list of tickets scoped by the user\'s role and tenant.',
  })
  @ApiQuery({
    name: 'tenant_id',
    required: true,
    description: 'Required. Tenant ID injected by the frontend.',
    example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of tickets',
    type: PaginatedTicketResponseDto,
  })
  findAll(
    @Query('tenant_id') tenantId: string,
    @Query('status') status?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '25',
  ) {
    return this.ticketsService.findAll(tenantId, {
      status,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  }

  @Get('list')
  @ApiOperation({
    summary: 'List tickets (alias)',
    description: 'Alias for GET /tickets with identical behaviour.',
  })
  @ApiQuery({
    name: 'tenant_id',
    required: true,
    description: 'Required. Tenant ID injected by the frontend.',
    example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of tickets',
    type: PaginatedTicketResponseDto,
  })
  findAllList(
    @Query('tenant_id') tenantId: string,
    @Query('status') status?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '25',
  ) {
    return this.ticketsService.findAll(tenantId, {
      status,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single ticket',
    description: 'Retrieve a ticket by its unique identifier.',
  })
  @ApiParam({
    name: 'id',
    description: 'Ticket ID',
    example: 'tkt_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiQuery({
    name: 'tenant_id',
    required: true,
    description: 'Tenant ID injected by the frontend.',
    example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket found',
    type: TicketDto,
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  findOne(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.ticketsService.findOne(id, tenantId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new ticket',
    description:
      'Creates a new ticket scoped to the current user\'s tenant. Triggers SLA clock start and routing rules.',
  })
  @ApiBody({ type: CreateTicketDto })
  @ApiResponse({
    status: 201,
    description: 'Ticket created successfully',
    type: TicketDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  create(
    @Body() dto: CreateTicketDto,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ticketsService.create({
      ...dto,
      tenant_id: tenantId,
      requester_id: userId,
    });
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update ticket fields',
    description:
      'Partial update of a ticket. Requires TICKET_EDIT or TICKET_ASSIGN permissions depending on fields changed.',
  })
  @ApiParam({
    name: 'id',
    description: 'Ticket ID',
    example: 'tkt_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiQuery({
    name: 'tenant_id',
    required: true,
    description: 'Tenant ID injected by the frontend.',
    example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiBody({ type: UpdateTicketDto })
  @ApiResponse({
    status: 200,
    description: 'Ticket updated',
    type: TicketDto,
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @Query('tenant_id') tenantId: string,
  ) {
    return this.ticketsService.update(id, tenantId, dto);
  }

  @Post(':id/transition')
  @ApiOperation({
    summary: 'Transition ticket status',
    description:
      'Changes a ticket\'s status following the state machine. Valid transitions: OPEN → ACKNOWLEDGED/IN_PROGRESS/CLOSED, ACKNOWLEDGED → IN_PROGRESS/CLOSED, IN_PROGRESS → RESOLVED/CLOSED, RESOLVED → CLOSED/OPEN, CLOSED → OPEN.',
  })
  @ApiParam({
    name: 'id',
    description: 'Ticket ID',
    example: 'tkt_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiQuery({
    name: 'tenant_id',
    required: true,
    description: 'Tenant ID injected by the frontend.',
    example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiBody({ type: TicketTransitionDto })
  @ApiResponse({
    status: 200,
    description: 'Status transitioned successfully',
    type: TicketDto,
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({ status: 422, description: 'Invalid transition' })
  transition(
    @Param('id') id: string,
    @Body() dto: TicketTransitionDto,
    @Query('tenant_id') tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ticketsService.transition(id, tenantId, dto.to_status, userId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a ticket',
    description: 'Permanently deletes a ticket. Requires TICKET_DELETE permission.',
  })
  @ApiParam({
    name: 'id',
    description: 'Ticket ID',
    example: 'tkt_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiQuery({
    name: 'tenant_id',
    required: true,
    description: 'Tenant ID injected by the frontend.',
    example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket deleted',
    type: TicketDeleteResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  remove(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.ticketsService.remove(id, tenantId);
  }
}

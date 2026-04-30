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
import {
  PaginatedTicketResponseDto,
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
  @ApiOperation({ summary: 'List tickets (paginated, filterable)' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'status', required: false, description: 'Repeatable. e.g. ?status=OPEN&status=IN_PROGRESS' })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'assignee_id', required: false })
  @ApiQuery({ name: 'requester_id', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sort_by', required: false })
  @ApiQuery({ name: 'sort_order', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, type: PaginatedTicketResponseDto })
  findAll(
    @Query('tenant_id') tenantId: string,
    @Query('status') status?: string | string[],
    @Query('priority') priority?: string | string[],
    @Query('category') category?: string,
    @Query('assignee_id') assignee_id?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('unassigned') unassigned?: string,
    @Query('requester_id') requester_id?: string,
    @Query('projectId') projectId?: string,
    @Query('search') search?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('page') page = '1',
    @Query('limit') limit?: string,
    @Query('page_size') page_size?: string,
    @Query('sort_by') sort_by?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sort_order') sort_order?: 'asc' | 'desc',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.ticketsService.findAll(tenantId, {
      status,
      priority,
      category,
      assignee_id,
      assignedTo,
      unassigned: unassigned === 'true',
      requester_id,
      project_id: projectId,
      search,
      date_from,
      date_to,
      page: parseInt(page, 10),
      limit: limit ? parseInt(limit, 10) : undefined,
      page_size: page_size ? parseInt(page_size, 10) : undefined,
      sort_by,
      sortBy,
      sort_order,
      sortOrder,
    });
  }

  @Get('list')
  @ApiOperation({ summary: 'List tickets — alias for GET /tickets' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: PaginatedTicketResponseDto })
  findAllList(
    @Query('tenant_id') tenantId: string,
    @Query('status') status?: string | string[],
    @Query('priority') priority?: string | string[],
    @Query('category') category?: string,
    @Query('assignee_id') assignee_id?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('unassigned') unassigned?: string,
    @Query('requester_id') requester_id?: string,
    @Query('projectId') projectId?: string,
    @Query('search') search?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('page') page = '1',
    @Query('limit') limit?: string,
    @Query('page_size') page_size?: string,
    @Query('sort_by') sort_by?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sort_order') sort_order?: 'asc' | 'desc',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.ticketsService.findAll(tenantId, {
      status,
      priority,
      category,
      assignee_id,
      assignedTo,
      unassigned: unassigned === 'true',
      requester_id,
      project_id: projectId,
      search,
      date_from,
      date_to,
      page: parseInt(page, 10),
      limit: limit ? parseInt(limit, 10) : undefined,
      page_size: page_size ? parseInt(page_size, 10) : undefined,
      sort_by,
      sortBy,
      sort_order,
      sortOrder,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single ticket by ID' })
  @ApiParam({ name: 'id', description: 'Ticket UUID or ticket_number (TKT-001)' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: TicketDto })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  findOne(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.ticketsService.findOne(id, tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new ticket' })
  @ApiBody({ type: CreateTicketDto })
  @ApiResponse({ status: 201, type: TicketDto })
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
  @ApiOperation({ summary: 'Partial-update ticket fields' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: UpdateTicketDto })
  @ApiResponse({ status: 200, type: TicketDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @Query('tenant_id') tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ticketsService.update(id, tenantId, dto, userId);
  }

  @Post(':id/transition')
  @ApiOperation({
    summary: 'Transition ticket status',
    description:
      'Valid transitions — OPEN→ACKNOWLEDGED|IN_PROGRESS|CLOSED, ACKNOWLEDGED→IN_PROGRESS|CLOSED, IN_PROGRESS→RESOLVED|CLOSED, RESOLVED→CLOSED|OPEN, CLOSED→OPEN',
  })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: TicketTransitionDto })
  @ApiResponse({ status: 200, type: TicketDto })
  @ApiResponse({ status: 422, description: 'Invalid status transition' })
  transition(
    @Param('id') id: string,
    @Body() dto: TicketTransitionDto,
    @Query('tenant_id') tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ticketsService.transition(id, tenantId, dto.to_status, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a ticket (requires TICKET_DELETE permission)' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: TicketDeleteResponseDto })
  remove(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.ticketsService.remove(id, tenantId);
  }
}

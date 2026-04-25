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
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('Comments')
@ApiCookieAuth('access_token')
@Controller()
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Get('tickets/:ticketId/comments')
  @ApiOperation({
    summary: 'Get comments for a ticket',
    description:
      'Returns all top-level comments with nested replies. CLIENT_* users only see public comments; AGENT+ see internal notes too.',
  })
  @ApiParam({ name: 'ticketId' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, description: 'List of comments' })
  findByTicket(
    @Param('ticketId') ticketId: string,
    @Query('tenant_id') tenantId: string,
    @CurrentUser('role') role: string,
  ) {
    const includeInternal = ['ADMIN', 'LEAD', 'AGENT'].includes(role);
    return this.commentsService.findByTicket(ticketId, tenantId, {
      includeInternal,
    });
  }

  @Post('tickets/:ticketId/comments')
  @ApiOperation({
    summary: 'Add a comment to a ticket (path-param style)',
    description:
      'is_internal=true requires COMMENT_INTERNAL permission. parent_id enables threading.',
  })
  @ApiParam({ name: 'ticketId' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: CreateCommentDto })
  @ApiResponse({ status: 201, description: 'Comment created' })
  createByPath(
    @Param('ticketId') ticketId: string,
    @Body() dto: CreateCommentDto,
    @Query('tenant_id') tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.commentsService.create({
      ...dto,
      ticket_id: ticketId,
      tenant_id: tenantId,
      author_id: userId,
    });
  }

  @Post('comments')
  @ApiOperation({
    summary: 'Add a comment to a ticket (body style — frontend compatible)',
    description:
      'Accepts ticket_id/ticketId, message/content/body, isInternal/is_internal, parent_id/parentId.',
  })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: CreateCommentDto })
  @ApiResponse({ status: 201, description: 'Comment created' })
  create(
    @Body() dto: CreateCommentDto,
    @Query('tenant_id') tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.commentsService.create({
      ...dto,
      tenant_id: tenantId,
      author_id: userId,
    });
  }

  @Patch('comments/:id')
  @ApiOperation({ summary: 'Edit a comment body (own comment or ADMIN/LEAD)' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, description: 'Comment updated' })
  update(
    @Param('id') id: string,
    @Body() dto: { body?: string; message?: string; content?: string },
    @Query('tenant_id') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    const text = dto.body ?? dto.message ?? dto.content ?? '';
    return this.commentsService.update(id, tenantId, userId, role, text);
  }

  @Delete('comments/:id')
  @ApiOperation({ summary: 'Delete a comment (own or ADMIN/LEAD)' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, description: 'Comment deleted' })
  remove(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.commentsService.remove(id, tenantId, userId, role);
  }
}

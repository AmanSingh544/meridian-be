import {
  Controller,
  Get,
  Post,
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
import {
  CommentsListResponseDto,
  SingleCommentResponseDto,
} from './dto/comment-response.dto';

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
      'Returns all comments on a ticket. CLIENT_USER / CLIENT_ADMIN see only public comments; AGENT / LEAD / ADMIN see internal notes as well.',
  })
  @ApiParam({
    name: 'ticketId',
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
    description: 'List of comments',
    type: CommentsListResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  findByTicket(
    @Param('ticketId') ticketId: string,
    @Query('tenant_id') tenantId: string,
  ) {
    return this.commentsService.findByTicket(ticketId, tenantId);
  }

  @Post('tickets/:ticketId/comments')
  @ApiOperation({
    summary: 'Create a comment on a ticket',
    description:
      'Adds a new comment. Requires COMMENT_CREATE. Internal notes (is_internal=true) require COMMENT_INTERNAL.',
  })
  @ApiParam({
    name: 'ticketId',
    description: 'Ticket ID',
    example: 'tkt_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiQuery({
    name: 'tenant_id',
    required: true,
    description: 'Tenant ID injected by the frontend.',
    example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiBody({ type: CreateCommentDto })
  @ApiResponse({
    status: 201,
    description: 'Comment created',
    type: SingleCommentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Ticket or parent comment not found' })
  create(
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
}

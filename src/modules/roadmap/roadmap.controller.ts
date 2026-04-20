import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RoadmapService } from './roadmap.service';
import {
  RoadmapFeatureResponseDto,
  SubmitFeatureRequestDto,
  VoteResponseDto,
} from './dto/roadmap.dto';

@ApiTags('Roadmap')
@ApiCookieAuth('access_token')
@Controller('roadmap')
@UseGuards(JwtAuthGuard)
export class RoadmapController {
  constructor(private roadmapService: RoadmapService) {}

  @Get()
  @ApiOperation({ summary: 'List roadmap features' })
  @ApiResponse({ status: 200, type: [RoadmapFeatureResponseDto] })
  findAll() {
    return this.roadmapService.findAll();
  }

  @Post('features/:id/vote')
  @ApiOperation({ summary: 'Vote for a feature' })
  @ApiParam({ name: 'id', example: 'rmf_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiResponse({ status: 200, type: VoteResponseDto })
  vote(@Param('id') id: string) {
    return this.roadmapService.vote(id);
  }

  @Delete('features/:id/vote')
  @ApiOperation({ summary: 'Remove vote from a feature' })
  @ApiParam({ name: 'id', example: 'rmf_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiResponse({ status: 200, type: VoteResponseDto })
  unvote(@Param('id') id: string) {
    return this.roadmapService.unvote(id);
  }

  @Post('requests')
  @ApiOperation({ summary: 'Submit a feature request' })
  @ApiBody({ type: SubmitFeatureRequestDto })
  @ApiResponse({ status: 201, type: RoadmapFeatureResponseDto })
  submitRequest(@Body() dto: SubmitFeatureRequestDto) {
    return this.roadmapService.submitRequest(dto);
  }
}

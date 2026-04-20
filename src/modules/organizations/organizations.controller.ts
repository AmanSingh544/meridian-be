import {
  Controller,
  Get,
  Patch,
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
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  PaginatedOrganizationResponseDto,
  SingleOrganizationResponseDto,
} from './dto/organization-response.dto';

@ApiTags('Organizations')
@ApiCookieAuth('access_token')
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private organizationsService: OrganizationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List organizations',
    description: 'Returns a paginated list of all organizations (ADMIN scoped).',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
    example: '1',
  })
  @ApiQuery({
    name: 'page_size',
    required: false,
    description: 'Items per page',
    example: '20',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of organizations',
    type: PaginatedOrganizationResponseDto,
  })
  findAll(
    @Query('page') page: string = '1',
    @Query('page_size') pageSize: string = '20',
  ) {
    return this.organizationsService.findAll(parseInt(page), parseInt(pageSize));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single organization',
    description: 'Retrieve an organization by ID with user and ticket counts.',
  })
  @ApiParam({
    name: 'id',
    description: 'Organization ID',
    example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiResponse({
    status: 200,
    description: 'Organization found',
    type: SingleOrganizationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an organization',
    description: 'Partial update of organization fields.',
  })
  @ApiParam({
    name: 'id',
    description: 'Organization ID',
    example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiBody({ type: UpdateOrganizationDto })
  @ApiResponse({
    status: 200,
    description: 'Organization updated',
    type: SingleOrganizationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.update(id, dto);
  }
}

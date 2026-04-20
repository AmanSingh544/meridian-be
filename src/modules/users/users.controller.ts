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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  PaginatedUserResponseDto,
  SingleUserResponseDto,
  UserDeleteResponseDto,
  UserDto,
} from './dto/user-response.dto';

@ApiTags('Users')
@ApiCookieAuth('access_token')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List users',
    description: 'Returns all users scoped to the provided tenant_id.',
  })
  @ApiQuery({
    name: 'tenant_id',
    required: true,
    description: 'Tenant ID injected by the frontend.',
    example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users',
    type: [UserDto],
  })
  findAll(@Query('tenant_id') tenantId: string) {
    return this.usersService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single user',
    description: 'Retrieve a user by ID including their preferences.',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiQuery({
    name: 'tenant_id',
    required: true,
    description: 'Tenant ID injected by the frontend.',
    example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: UserDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.usersService.findOne(id, tenantId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a user',
    description:
      'Creates a new user within the tenant. If no password is provided, a temporary random password is generated.',
  })
  @ApiQuery({
    name: 'tenant_id',
    required: true,
    description: 'Tenant ID injected by the frontend.',
    example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserDto,
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  create(@Body() dto: CreateUserDto, @Query('tenant_id') tenantId: string) {
    return this.usersService.create({ ...dto, tenant_id: tenantId });
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a user',
    description: 'Partial update of user fields. Password changes are hashed automatically.',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiQuery({
    name: 'tenant_id',
    required: true,
    description: 'Tenant ID injected by the frontend.',
    example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User updated',
    type: UserDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Query('tenant_id') tenantId: string,
  ) {
    return this.usersService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a user',
    description: 'Permanently removes a user from the tenant.',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiQuery({
    name: 'tenant_id',
    required: true,
    description: 'Tenant ID injected by the frontend.',
    example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted',
    type: UserDeleteResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.usersService.remove(id, tenantId);
  }
}

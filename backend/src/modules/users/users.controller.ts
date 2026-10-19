import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { CurrentUser, Public, Roles, type AuthUser } from '../../common/auth/decorators';
import { AssignServicesDto, ChangePasswordDto, LoginDto, RegisterDto, UpdateProfileDto, UpdateRoleDto } from './dto/users.dto';

@ApiTags('users')
@Controller('users')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register new user (first user becomes ADMIN, others DEVELOPER)' })
  register(@Body() dto: RegisterDto) {
    return this.usersService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'User login, returns a JWT' })
  login(@Body() dto: LoginDto) {
    return this.usersService.login(dto.email, dto.password);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@CurrentUser() user: AuthUser) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto.name);
  }

  @Post('profile/password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Change password' })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get all users (admin only)' })
  getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Patch(':id/role')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Change a user role (admin only)' })
  updateRole(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.usersService.updateRole(actor, id, dto.role);
  }

  @Post(':id/services')
  @Roles('ADMIN', 'SECURITY_LEAD')
  @ApiOperation({ summary: 'Assign owned services to user' })
  assignServices(@Param('id') id: string, @Body() dto: AssignServicesDto) {
    return this.usersService.assignServices(id, dto.services);
  }
}

import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  register(@Body() registerDto: any) {
    return this.usersService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  login(@Body() loginDto: any) {
    return this.usersService.login(loginDto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Body('userId') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users (admin only)' })
  getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Post(':id/services')
  @ApiOperation({ summary: 'Assign services to user' })
  assignServices(@Param('id') id: string, @Body('services') services: string[]) {
    return this.usersService.assignServices(id, services);
  }
}

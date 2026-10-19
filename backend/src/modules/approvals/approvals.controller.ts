import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth/decorators';
import { ApproveDeploymentDto, DeploymentsQueryDto, ExceptionDto, RejectDeploymentDto, RequestDeploymentDto } from './dto/approvals.dto';

@ApiTags('approvals')
@Controller('approvals')
@ApiBearerAuth()
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Post('deployments')
  @ApiOperation({ summary: 'Request deployment approval (runs the findings gate)' })
  requestDeployment(@Body() dto: RequestDeploymentDto, @CurrentUser() user: AuthUser) {
    return this.approvalsService.requestDeployment(dto, user.email, user);
  }

  @Get('eligibility')
  @ApiOperation({ summary: 'Check whether a service/environment would pass the findings gate' })
  eligibility(@Query('service') service: string, @Query('environment') environment: string) {
    return this.approvalsService.checkDeploymentEligibility(service, environment);
  }

  @Post('deployments/:id/approve')
  @HttpCode(200)
  @Roles('ADMIN', 'SECURITY_LEAD')
  @ApiOperation({ summary: 'Approve deployment' })
  approveDeployment(@Param('id') id: string, @Body() dto: ApproveDeploymentDto, @CurrentUser() user: AuthUser) {
    return this.approvalsService.approveDeployment(id, user, dto.comments);
  }

  @Post('deployments/:id/reject')
  @HttpCode(200)
  @Roles('ADMIN', 'SECURITY_LEAD')
  @ApiOperation({ summary: 'Reject deployment' })
  rejectDeployment(@Param('id') id: string, @Body() dto: RejectDeploymentDto, @CurrentUser() user: AuthUser) {
    return this.approvalsService.rejectDeployment(id, user, dto.reason);
  }

  @Post('deployments/:id/exception')
  @HttpCode(200)
  @Roles('ADMIN', 'SECURITY_LEAD')
  @ApiOperation({ summary: 'Grant an exception for gate-blocking critical findings (moves back to PENDING)' })
  grantException(@Param('id') id: string, @Body() dto: ExceptionDto, @CurrentUser() user: AuthUser) {
    return this.approvalsService.grantException(id, user, dto.findingIds, dto.justification);
  }

  @Post('deployments/:id/deployed')
  @HttpCode(200)
  @Roles('ADMIN', 'SECURITY_LEAD')
  @ApiOperation({ summary: 'Mark an approved deployment as deployed' })
  markDeployed(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.approvalsService.markDeployed(id, user.email);
  }

  @Post('deployments/:id/rollback')
  @HttpCode(200)
  @Roles('ADMIN', 'SECURITY_LEAD')
  @ApiOperation({ summary: 'Record a rollback of a deployed release' })
  rollback(@Param('id') id: string, @Body() dto: ApproveDeploymentDto, @CurrentUser() user: AuthUser) {
    return this.approvalsService.rollback(id, user.email, dto.comments);
  }

  @Get('deployments/:id/status')
  @ApiOperation({ summary: 'Deployment with its approval decisions' })
  getDeploymentStatus(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.approvalsService.getDeploymentStatus(id, user);
  }

  @Get('deployments')
  @ApiOperation({ summary: 'List deployments (defaults to all; filter by status, service, environment)' })
  list(@Query() query: DeploymentsQueryDto, @CurrentUser() user: AuthUser) {
    return this.approvalsService.listDeployments(query, user);
  }

  @Get('deployments/:id/history')
  @ApiOperation({ summary: 'Approval history of a deployment' })
  getApprovalHistory(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.approvalsService.getApprovalHistory(id, user);
  }
}

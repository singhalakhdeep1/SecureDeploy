import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('approvals')
@Controller('approvals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Post('deployments')
  @ApiOperation({ summary: 'Request deployment approval' })
  requestDeployment(@Body() requestDto: any) {
    return this.approvalsService.requestDeployment(requestDto);
  }

  @Post('deployments/:id/approve')
  @ApiOperation({ summary: 'Approve deployment' })
  approveDeployment(
    @Param('id') id: string,
    @Body() approvalDto: any
  ) {
    return this.approvalsService.approveDeployment(id, approvalDto);
  }

  @Post('deployments/:id/reject')
  @ApiOperation({ summary: 'Reject deployment' })
  rejectDeployment(
    @Param('id') id: string,
    @Body() rejectionDto: any
  ) {
    return this.approvalsService.rejectDeployment(id, rejectionDto);
  }

  @Get('deployments/:id/status')
  @ApiOperation({ summary: 'Get deployment approval status' })
  getDeploymentStatus(@Param('id') id: string) {
    return this.approvalsService.getDeploymentStatus(id);
  }

  @Get('deployments')
  @ApiOperation({ summary: 'Get all pending deployments' })
  getPendingDeployments(@Query('service') service?: string) {
    return this.approvalsService.getPendingDeployments(service);
  }

  @Get('deployments/:id/history')
  @ApiOperation({ summary: 'Get deployment approval history' })
  getApprovalHistory(@Param('id') id: string) {
    return this.approvalsService.getApprovalHistory(id);
  }
}

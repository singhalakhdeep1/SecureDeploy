import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { FindingsModule } from '../findings/findings.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { ScansModule } from '../scans/scans.module';
import { WebhookGuard } from '../../common/guards/webhook.guard';

@Module({
  imports: [FindingsModule, ApprovalsModule, ScansModule],
  controllers: [WebhooksController],
  providers: [WebhookGuard],
})
export class WebhooksModule {}

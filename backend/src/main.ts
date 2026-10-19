import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody keeps the exact request bytes for webhook HMAC verification.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.useBodyParser('json', { limit: process.env.BODY_LIMIT || '25mb' });
  app.set('trust proxy', 1);
  app.use(helmet());
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: (process.env.FRONTEND_URL || 'http://localhost:3000').split(','),
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'X-Correlation-Id'],
  });

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('SecureDeploy API')
    .setDescription('Security compliance and deployment approval platform')
    .setVersion('1.1')
    .addTag('findings', 'Security findings management')
    .addTag('compliance', 'Compliance mapping and status')
    .addTag('approvals', 'Deployment approval workflow')
    .addTag('users', 'User management and authentication')
    .addTag('reporting', 'Compliance report generation')
    .addTag('scans', 'Image scanning (Grype, Trivy) and SBOMs (Syft)')
    .addTag('webhooks', 'CI/CD and scanner ingestion')
    .addTag('audit', 'Audit trail and health')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(JSON.stringify({ level: 'Information', message: `SecureDeploy API on :${port} (docs at /api/docs)` }));
}

bootstrap();

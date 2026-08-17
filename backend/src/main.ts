import 'dotenv/config';

import { BadRequestException, ValidationPipe, type ValidationError } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import {
  allowedCorsOrigins,
  requestUsesHttps,
  securityHeaders,
  shouldEnforceHttps,
} from './infrastructure/http/security.config';
import { requestUsageLogger } from './infrastructure/http/request-usage-logger.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const enforceHttps = shouldEnforceHttps(process.env.ENFORCE_HTTPS, process.env.NODE_ENV);

  app.use(requestUsageLogger());

  if (enforceHttps) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    app.use((request: Request, response: Response, next: NextFunction) => {
      if (requestUsesHttps(request.secure, request.headers['x-forwarded-proto'])) {
        next();
        return;
      }

      response.redirect(308, `https://${request.get('host')}${request.originalUrl}`);
    });
  }

  app.enableCors({
    origin: allowedCorsOrigins(process.env.CORS_ORIGINS, process.env.NODE_ENV),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Request-Id'],
    credentials: false,
    maxAge: 86_400,
  });
  app.use(helmet(securityHeaders(enforceHttps)));
  app.use((request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=()');
    if (request.path.startsWith('/api/checkout')) response.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'The request contains invalid data.',
            details: validationMessages(errors),
          },
        }),
    }),
  );

  const openApiConfig = new DocumentBuilder()
    .setTitle('Payment Checkout API')
    .setDescription('REST API for the product checkout and payment flow.')
    .setVersion('1.0.0')
    .addTag('Health')
    .addTag('Products')
    .addTag('Checkout')
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup('api/docs', app, openApiDocument, {
    customSiteTitle: 'Payment Checkout API Docs',
  });

  await app.listen(process.env.PORT ?? 3000);
}

function validationMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...validationMessages(error.children ?? []),
  ]);
}

void bootstrap();

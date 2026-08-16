import 'dotenv/config';

import { BadRequestException, ValidationPipe, type ValidationError } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

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

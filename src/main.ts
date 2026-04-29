import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { CamelToSnakeInterceptor } from './shared/interceptors/camel-to-snake.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);

  // WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Security
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // CORS - strict origins
  const allowedOrigins = config.get<string>('ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:3001').split(',');
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  });

  // Convert camelCase body keys → snake_case before validation (frontend sends camelCase)
  app.useGlobalInterceptors(new CamelToSnakeInterceptor());

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Swagger / OpenAPI documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('3SC Platform API')
    .setDescription(
      'Meridian Platform — Backend API Specification.\n\n' +
      '## Authentication\n' +
      'This API uses **HttpOnly cookie-based sessions**. ' +
      'Include `credentials: include` in all frontend requests. ' +
      'The `access_token` cookie is validated automatically.\n\n' +
      '## Multi-tenancy\n' +
      'Every authenticated request must include a `tenant_id` query parameter.',
    )
    .setVersion('1.0.0')
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
      description: 'HttpOnly cookie containing the JWT access token',
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/v1/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server running on http://0.0.0.0:${port}/api/v1`);
  console.log(`📚 API docs available at http://0.0.0.0:${port}/api/v1/docs`);
}

bootstrap();

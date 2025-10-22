import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import 'dotenv/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { EventEmitter } from 'events';
import { TLSSocket } from 'tls';

(TLSSocket.prototype as unknown as EventEmitter).setMaxListeners(50);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const isProduction = process.env.NODE_ENV === 'production';
  const corsOrigin = isProduction
    ? process.env.CORS_ORIGIN_PROD
    : process.env.CORS_ORIGIN_DEV;

  if (!corsOrigin) {
    throw new Error(`CORS_ORIGIN_${isProduction ? 'PROD' : 'DEV'} is not set!`);
  }

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Package Health API')
    .setDescription(
      'API to analyze GitHub repos, package.json, and user profiles',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT;
  if (!port) {
    throw new Error('PORT is not set in environment variables!');
  }

  await app.listen(port);
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📖 Swagger docs available at /api`);
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

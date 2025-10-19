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

  // For serverless, don't call listen(), just init and return
  await app.init();
  return app;
}

// Export for serverless
const appPromise = bootstrap();

// For local development
if (process.env.NODE_ENV !== 'production') {
  (async () => {
    const app = await appPromise;
    const port = process.env.PORT ?? 8000;
    void app.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}`);
      console.log(`📖 Swagger docs available at http://localhost:${port}/api`);
    });
  })().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default appPromise.then(
  (app) => app.getHttpAdapter().getInstance() as Express.Application,
);

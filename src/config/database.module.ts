import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('MONGO_URI');

        if (!uri) {
          throw new Error('MONGO_URI is not defined in environment variables');
        }

        const isProduction =
          configService.get<string>('NODE_ENV') === 'production';

        return {
          uri,
          retryWrites: true,
          w: 'majority',
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 30000,
          socketTimeoutMS: 45000,
          family: 4,
          tls: true,
          tlsAllowInvalidCertificates: !isProduction,
          tlsAllowInvalidHostnames: !isProduction,
          bufferCommands: false,
          retryAttempts: 10,
          retryDelay: 5000,
          autoIndex: !isProduction,
          maxPoolSize: 10,
          minPoolSize: 2,
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}

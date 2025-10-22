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

        return {
          uri,
          retryWrites: true,
          serverSelectionTimeoutMS: 5000,
          ssl: true,
          tls: true,
          tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production',
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}

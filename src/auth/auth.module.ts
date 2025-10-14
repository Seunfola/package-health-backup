import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { GitHubStrategy } from './github.strategy';
import { AuthController } from './auth.controller';

@Module({
  imports: [PassportModule.register({ session: false })],
  providers: [AuthService, GitHubStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}

import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { GitHubStrategy } from './github.strategy';

@Module({
  imports: [PassportModule.register({ session: false })],
  providers: [AuthService, GitHubStrategy],
  exports: [AuthService],
})
export class AuthModule {}

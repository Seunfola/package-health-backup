import { Injectable } from '@nestjs/common';
import { GithubProfile } from './auth.interface';

@Injectable()
export class AuthService {

  validateUser(githubProfile: GithubProfile) {
    return {
      githubId: githubProfile.id,
      username: githubProfile.username,
      token: githubProfile.accessToken,
    };
  }
}

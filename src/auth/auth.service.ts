export interface GithubProfile {
  id: string;
  username: string;
  accessToken: string;
}

import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  // Optionally persist user in DB
  validateUser(githubProfile: GithubProfile) {
    return {
      githubId: githubProfile.id,
      username: githubProfile.username,
      token: githubProfile.accessToken,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor() {
    const clientID = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const callbackURL = process.env.GITHUB_CALLBACK_URL;

    // ✅ Ensure none are undefined before calling super
    if (!clientID || !clientSecret || !callbackURL) {
      throw new Error(
        'GitHub OAuth environment variables (CLIENT_ID, CLIENT_SECRET, CALLBACK_URL) must be set',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['repo', 'read:user'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Record<string, unknown>,
  ): { githubId: string; username: string; accessToken: string } {
    const githubId =
      typeof profile?.id === 'string' || typeof profile?.id === 'number'
        ? String(profile.id)
        : '';
    const username =
      typeof profile?.username === 'string'
        ? profile.username
        : typeof profile?.displayName === 'string'
          ? profile.displayName
          : 'unknown';

    return { githubId, username, accessToken };
  }
}

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { GitHubValidateResult } from '../auth.interface';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor() {
    const clientID = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const callbackURL = process.env.GITHUB_CALLBACK_URL;

    if (!clientID || !clientSecret || !callbackURL) {
      throw new Error(
        'GitHub OAuth environment variables (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL) must be set',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['repo', 'read:user'],
    } as any);
  }

  validate(
    accessToken: string,
    _refreshToken: string,
    profile: Record<string, unknown>,
  ): GitHubValidateResult {
    // Convert id to string if present, else default to ''
    const rawId = profile?.id;
    const githubId =
      typeof rawId === 'string' || typeof rawId === 'number'
        ? String(rawId)
        : '';

    // Determine username
    const username =
      typeof (profile as any).username === 'string'
        ? (profile as any).username
        : typeof (profile as any).displayName === 'string'
          ? (profile as any).displayName
          : 'unknown';

    return {
      githubId,
      username,
      accessToken,
    };
  }
}

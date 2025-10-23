import { HttpException, HttpStatus } from '@nestjs/common';

export class GitHubErrorHandler {
  static handle(
    owner: string,
    repo: string,
    err: any,
    context = 'GitHub API',
  ): never {
    const status = err?.response?.status ?? err?.status ?? 500;
    const data = err?.response?.data;
    const message =
      (typeof data === 'object' && data?.message) ||
      err?.message ||
      'Unknown GitHub error';

    console.error(`[${context}] Error for ${owner}/${repo}`, {
      status,
      message,
      url: err?.config?.url,
      method: err?.config?.method,
      headers: err?.config?.headers,
      data,
    });

    // 404 — Repo does not exist
    if (status === 404 || message.includes('Not Found')) {
      throw new HttpException(
        {
          message: `Repository '${owner}/${repo}' was not found.`,
          hint: 'Ensure the owner/repo name is correct or repository is public.',
          reason: 'NOT_FOUND',
          context,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Invalid / expired token
    if (
      [401, 403].includes(status) &&
      (message.toLowerCase().includes('bad credentials') ||
        message.toLowerCase().includes('invalid token'))
    ) {
      throw new HttpException(
        {
          message: `Invalid or expired GitHub token provided.`,
          hint: 'Generate a new personal access token with "repo" scope.',
          reason: 'INVALID_TOKEN',
          context,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Private or unauthorized repository access
    if ([401, 403].includes(status)) {
      throw new HttpException(
        {
          message: `Repository '${owner}/${repo}' is private or requires authentication.`,
          hint: 'Provide a valid GitHub personal access token for private repositories.',
          reason: 'PRIVATE_OR_UNAUTHORIZED',
          context,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Rate limit exceeded
    if (
      status === 429 ||
      message.toLowerCase().includes('rate limit') ||
      data?.message?.toLowerCase().includes('api rate limit exceeded')
    ) {
      throw new HttpException(
        {
          message:
            'GitHub API rate limit exceeded. Try again later or use a token.',
          reason: 'RATE_LIMIT',
          context,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Network issues / timeouts
    if (
      message.toLowerCase().includes('timeout') ||
      message.toLowerCase().includes('network')
    ) {
      throw new HttpException(
        {
          message: 'Network issue while connecting to GitHub.',
          reason: 'NETWORK_ERROR',
          context,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    // Default fallback
    throw new HttpException(
      {
        message: `Unexpected GitHub API error: ${message}`,
        reason: 'UNKNOWN',
        context,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}

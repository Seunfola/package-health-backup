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

    // Handle 404
    if (status === 404 || message.includes('Not Found')) {
      throw new HttpException(
        {
          message: `Repository '${owner}/${repo}' was not found.`,
          hint: 'Ensure the owner/repo name is correct.',
          reason: 'NOT_FOUND',
          context,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Handle unauthorized/private access
    if ([401, 403].includes(status)) {
      throw new HttpException(
        {
          message: `Repository '${owner}/${repo}' is private or requires a valid token.`,
          hint: 'Provide a valid GitHub personal access token.',
          reason: 'PRIVATE_OR_UNAUTHORIZED',
          context,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Handle rate limit exceeded
    if (status === 429 || message.toLowerCase().includes('rate limit')) {
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

    // Catch network/timeout cases
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

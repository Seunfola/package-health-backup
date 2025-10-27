export const GITHUB_CONFIG = {
  BASE_URL: 'https://api.github.com',
  CACHE_TTL: {
    VISIBILITY: 60 * 60 * 1000, // 1 hour
    REPO_DATA: 30 * 60 * 1000, // 30 minutes
  },
  RATE_LIMIT: {
    MAX_REQUESTS: 5000,
    WINDOW_MS: 60 * 60 * 1000,
  },
  TIMEOUT: 10000, // 10 seconds
} as const;

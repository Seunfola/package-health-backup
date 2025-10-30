export interface GithubProfile {
  id: string;
  username: string;
  accessToken: string;
}

export type GitHubValidateResult = {
  githubId: string;
  username: string;
  accessToken: string;
};

export interface JwtPayload {
  sub?: string;
  username?: string;
  githubId?: string;
  iat?: number;
  exp?: number;
}
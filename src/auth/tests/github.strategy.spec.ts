import { GitHubStrategy } from "../strategy/github.strategy";

describe('GitHubStrategy', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('throws when required env vars missing', () => {
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    delete process.env.GITHUB_CALLBACK_URL;

    expect(() => new GitHubStrategy()).toThrow(
      /GitHub OAuth environment variables .* must be set/,
    );
  });

  it('constructs and validate normalizes profile shapes', () => {
    process.env.GITHUB_CLIENT_ID = 'id';
    process.env.GITHUB_CLIENT_SECRET = 'secret';
    process.env.GITHUB_CALLBACK_URL = 'https://host/cb';

    const strat = new GitHubStrategy();

    // numeric id case
    const result1 = strat.validate('token1', '', {
      id: 12345,
      username: 'seun',
    } as any);
    expect(result1).toEqual({
      githubId: '12345',
      username: 'seun',
      accessToken: 'token1',
    });

    // missing username but displayName present
    const result2 = strat.validate('token2', '', {
      id: 'abc',
      displayName: 'Seun Display',
    } as any);
    expect(result2).toEqual({
      githubId: 'abc',
      username: 'Seun Display',
      accessToken: 'token2',
    });

    // totally empty profile -> username becomes 'unknown'
    const result3 = strat.validate('token3', '', {} as any);
    expect(result3).toEqual({
      githubId: '',
      username: 'unknown',
      accessToken: 'token3',
    });
  });
});

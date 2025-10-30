import { GithubProfile } from "../auth.interface";
import { AuthService } from "../auth.service";

describe('AuthService', () => {
  let svc: AuthService;

  beforeEach(() => {
    svc = new AuthService();
  });

  it('validates and returns normalized user object', () => {
    const profile: GithubProfile = {
      id: '42',
      username: 'seun',
      accessToken: 'token-abc',
    };

    const out = svc.validateUser(profile);
    expect(out).toEqual({
      githubId: '42',
      username: 'seun',
      token: 'token-abc',
    });
  });
});

import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../strategy/jwt.strategy';

describe('JwtStrategy', () => {
  let strat: JwtStrategy;
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, JWT_SECRET: 'testsecret' };
    strat = new JwtStrategy();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('validate throws on missing fields', () => {
    expect(() => strat.validate({} as any)).toThrow(UnauthorizedException);
  });

  it('validate returns normalized user when payload ok', () => {
    const payload = { sub: 'user-1', username: 'seun', githubId: '42' };
    const result = strat.validate(payload);
    expect(result).toEqual({
      userId: 'user-1',
      username: 'seun',
      githubId: '42',
    });
  });

  it('coerces userId to string', () => {
    const payload = { sub: 123, username: 'seun' };
    const result = strat.validate(payload as any);
    expect(result.userId).toBe('123');
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { UserProfileService } from '../user-profile.service';
import { UserProfile } from '../user-profile.model';

class MockHttpService {
get = jest.fn();
}

class MockUserProfileModel {
constructor(private data: any) {}

save = jest.fn().mockImplementation(() => {
return Promise.resolve({
_id: '507f1f77bcf86cd799439011',
...this.data,
createdAt: new Date(),
});
});

static find = jest.fn().mockReturnValue({
exec: jest.fn().mockResolvedValue([
{ username: 'seun', email: '[seun@example.com](mailto:seun@example.com)' },
{ username: 'folahan', email: '[fola@example.com](mailto:fola@example.com)' },
]),
});

static findOne = jest.fn().mockReturnValue({
exec: jest.fn().mockResolvedValue({ username: 'seun', bio: 'Engineer' }),
});

static findByIdAndUpdate = jest.fn().mockReturnValue({
exec: jest.fn().mockResolvedValue({
_id: '507f1f77bcf86cd799439011',
name: 'Updated Seun',
}),
});
}

describe('UserProfileService Functional', () => {
let service: UserProfileService;
let httpService: MockHttpService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
UserProfileService,
{ provide: HttpService, useClass: MockHttpService },
{
provide: getModelToken(UserProfile.name),
useValue: MockUserProfileModel,
},
],
}).compile();

service = module.get<UserProfileService>(UserProfileService);
httpService = module.get(HttpService);

// silence console noise from intentional errors
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'log').mockImplementation(() => {});


});

const sanitizeTimestamps = (obj: any): any => {
if (!obj || typeof obj !== 'object') return obj;
if (obj instanceof Date) return '[timestamp]';
const sanitized: any = Array.isArray(obj) ? [] : {};
for (const [key, value] of Object.entries(obj)) {
sanitized[key] =
key.toLowerCase().includes('date') || key.toLowerCase().includes('at')
? '[timestamp]'
: sanitizeTimestamps(value);
}
return sanitized;
};

it('should create and persist a user profile correctly', async () => {
const mockData = { username: 'seun', email: '[seun@example.com](mailto:seun@example.com)' };
const result = await service.create(mockData);


const sanitized = sanitizeTimestamps(result);
expect(sanitized).toMatchObject({
  username: 'seun',
  email: 'seun@example.com',
  _id: expect.any(String),
  createdAt: '[timestamp]',
});


});

it('should find user by username', async () => {
const result = await service.findByUsername('seun');
expect(result).toMatchObject({ username: 'seun', bio: 'Engineer' });
});

it('should return all profiles with stable structure', async () => {
const result = await service.findAll();
expect(Array.isArray(result)).toBe(true);
expect(result[0]).toHaveProperty('username');
expect(result[0]).toHaveProperty('email');
});

it('should update profile and persist new values', async () => {
const updated = await service.updateProfile('507f1f77bcf86cd799439011', {
name: 'Updated Seun',
});
expect(updated.name).toBe('Updated Seun');
expect(updated._id).toBe('507f1f77bcf86cd799439011');
});

it('should parse resume data into a structured object', () => {
const resume = service.parseResume();
expect(resume).toHaveProperty('name', 'John Doe');
expect(resume.email).toMatch(/@example.com$/);
expect(resume.linkedin_url).toContain('linkedin.com');
});

it('should fetch GitHub profile and sanitize output', async () => {
httpService.get.mockReturnValue(
of({
data: {
avatar_url: '[https://avatars.githubusercontent.com/u/1?v=4](https://avatars.githubusercontent.com/u/1?v=4)',
html_url: '[https://github.com/seunfola](https://github.com/seunfola)',
name: 'Seun Fola',
bio: 'Senior Software Engineer',
},
}),
);


const result = await service.getSocialProfileData('github', 'seunfola');
expect(result).toMatchObject({
  profile_picture_url: expect.stringContaining('https://avatars.'),
  github_url: 'https://github.com/seunfola',
  name: 'Seun Fola',
  bio: 'Senior Software Engineer',
});


});

it('should handle GitHub API errors gracefully', async () => {
httpService.get.mockReturnValue(
throwError(() => new Error('Network Error')),
);
await expect(
service.getSocialProfileData('github', 'erroruser'),
).rejects.toThrow('Fetching GitHub profile failed: Network Error');
});

it('should return LinkedIn profile link correctly', async () => {
const result = await service.getSocialProfileData('linkedin', 'seun');
expect(result.linkedin_url).toBe('[https://linkedin.com/in/seun](https://linkedin.com/in/seun)');
});

it('should reject unsupported social platforms', async () => {
await expect(
service.getSocialProfileData('twitter', 'seun'),
).rejects.toThrow('Unsupported social media platform: twitter');
});

describe('Security and Sanitization', () => {
it('should reject unsafe HTML or script injection in GitHub API data', async () => {
httpService.get.mockReturnValue(
of({
data: {
avatar_url: '[https://avatars.githubusercontent.com/u/1?v=4](https://avatars.githubusercontent.com/u/1?v=4)',
html_url: '[https://github.com/seun](https://github.com/seun)',
name: '<script>alert("xss")</script>',
bio: '<img src=x onerror=alert("hack")>',
},
}),
);


  const result = await service.getSocialProfileData('github', 'seun');
  expect(result.name).not.toContain('<script>');
  expect(result.bio).not.toContain('<img');
  expect(result.bio).not.toContain('onerror');
});

it('should prevent null or malformed GitHub API responses', async () => {
  httpService.get.mockReturnValue(of({ data: null }));
  await expect(
    service.getSocialProfileData('github', 'baduser'),
  ).rejects.toThrow('Fetching GitHub profile failed:');
});

it('should not leak internal errors or stack traces', async () => {
  httpService.get.mockReturnValue(
    throwError(() => new Error('Secret stack trace')),
  );
  try {
    await service.getSocialProfileData('github', 'user');
  } catch (err: any) {
    expect(err.message).not.toContain('stack');
    expect(err.message).toContain('Fetching GitHub profile failed');
  }
});

});
});

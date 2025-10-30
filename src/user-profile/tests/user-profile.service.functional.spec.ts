import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { UserProfileService } from '../user-profile.service';
import { UserProfile } from '../user-profile.model';

describe('UserProfileService (Functional)', () => {
  let service: UserProfileService;
  let httpService: HttpService;
  let userModel: any;

  beforeAll(async () => {
    // Suppress console.error during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock HttpService
    const mockHttpService = { get: jest.fn() };

    // Mock Mongoose model
    const mockUserModel: any = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue(data),
    }));
    mockUserModel.find = jest.fn().mockReturnThis();
    mockUserModel.findOne = jest.fn().mockReturnThis();
    mockUserModel.findByIdAndUpdate = jest.fn().mockReturnThis();
    mockUserModel.exec = jest.fn().mockResolvedValue([]);
    mockUserModel.prototype.save = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: getModelToken(UserProfile.name), useValue: mockUserModel },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
    httpService = module.get<HttpService>(HttpService);
    userModel = module.get(getModelToken(UserProfile.name));
  });

  it('should define service', () => {
    expect(service).toBeDefined();
  });

  it('should create a user and strip markdown from email', async () => {
    const result = await service.create({
      email: '[Email](hello@example.com)',
    });
    expect(result.email).toBe('hello@example.com');
  });

  it('should return all users using findAll()', async () => {
    const users = await service.findAll();
    expect(userModel.find).toHaveBeenCalled();
    expect(users).toEqual([]);
  });

  it('should find a user by username', async () => {
    await service.findByUsername('seun');
    expect(userModel.findOne).toHaveBeenCalledWith({ username: 'seun' });
  });

  it('should update a user profile', async () => {
    userModel.exec.mockResolvedValueOnce({
      username: 'seun',
      email: 'hello@example.com',
    });
    const updated = await service.updateProfile('id123', {
      email: 'new@example.com',
    });
    expect(updated.email).toBe('hello@example.com');
  });

  it('should parse resume correctly', () => {
    const resume = service.parseResume();
    expect(resume).toEqual({
      name: 'John Doe',
      email: 'john@example.com',
      linkedin_url: 'https://linkedin.com/in/johndoe',
    });
  });

  it('should return linkedin URL', async () => {
    const result = await service.getSocialProfileData('linkedin', 'john');
    expect(result.linkedin_url).toBe('https://linkedin.com/in/john');
  });

  it('should fetch GitHub profile and sanitize', async () => {
    const mockData = {
      data: {
        avatar_url: 'https://avatars.githubusercontent.com/u/1',
        html_url: 'https://github.com/octocat',
        name: '<b>Octocat</b>',
        bio: '<script>alert("xss")</script>GitHub mascot',
      },
    };
    jest.spyOn(httpService, 'get').mockReturnValue(of(mockData as any));

    const result = await service.getSocialProfileData('github', 'octocat');
    expect(result.github_url).toBe('https://github.com/octocat');
    expect(result.name).toBe('Octocat');
    expect(result.bio).toBe('GitHub mascot');
  });

  it('should throw when GitHub API fails', async () => {
    jest
      .spyOn(httpService, 'get')
      .mockReturnValue(throwError(() => new Error('Network down')));
    await expect(
      service.getSocialProfileData('github', 'unknown'),
    ).rejects.toThrow('Fetching GitHub profile failed: Network down');
  });

  it('should throw when platform is unsupported', async () => {
    await expect(
      service.getSocialProfileData('twitter', 'john'),
    ).rejects.toThrow('Unsupported social media platform: twitter');
  });
});

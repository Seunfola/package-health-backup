import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { Model } from 'mongoose';
import { UserProfileService } from '../user-profile.service';
import { UserProfile } from '../user-profile.model';

describe('UserProfileService', () => {
  let service: UserProfileService;
  let mockModel: jest.Mocked<Model<UserProfile>>;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        {
          provide: getModelToken(UserProfile.name),
          useValue: {
            find: jest.fn().mockReturnValue({ exec: jest.fn() }),
            findOne: jest.fn().mockReturnValue({ exec: jest.fn() }),
            findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn() }),
          },
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
    mockModel = module.get(getModelToken(UserProfile.name));
    httpService = module.get(HttpService);
  });

  describe('create', () => {
    it('should create and save a new user profile', async () => {
      const mockData = { username: 'seun', email: 'seun@example.com' };
      const saveMock = jest.fn().mockResolvedValue({ ...mockData, _id: '1' });
      (mockModel as any).mockImplementation(() => ({ save: saveMock }));

      const result = await service.create(mockData);

      expect(saveMock).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining(mockData));
    });
  });

  describe('findByUsername', () => {
    it('should find a user by username', async () => {
      const mockUser = { username: 'seun' };
      (mockModel.findOne as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as any);

      const result = await service.findByUsername('seun');
      expect(result).toEqual(mockUser);
      expect(mockModel.findOne).toHaveBeenCalledWith({ username: 'seun' });
    });
  });

  describe('findAll', () => {
    it('should return all user profiles', async () => {
      const mockProfiles = [{ username: 'seun' }, { username: 'folahan' }];
      mockModel.find.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockProfiles),
      } as any);

      const result = await service.findAll();
      expect(result).toEqual(mockProfiles);
    });
  });

  describe('updateProfile', () => {
    it('should update and return the user profile', async () => {
      const updatedProfile = { _id: '1', name: 'Updated Name' };
      mockModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedProfile),
      } as any);

      const result = await service.updateProfile('1', { name: 'Updated Name' });
      expect(result).toEqual(updatedProfile);
    });

    it('should throw error if update fails', async () => {
      mockModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(service.updateProfile('1', {})).rejects.toThrow(
        'Updating user profile failed:',
      );
    });
  });

  describe('parseResume', () => {
    it('should return parsed resume fields', () => {
      const result = service.parseResume();
      expect(result).toHaveProperty('name', 'John Doe');
      expect(result).toHaveProperty('linkedin_url');
    });
  });

  describe('getSocialProfileData', () => {
    it('should return LinkedIn profile link', async () => {
      const result = await service.getSocialProfileData('linkedin', 'seun');
      expect(result).toEqual({ linkedin_url: 'https://linkedin.com/in/seun' });
    });

    it('should call getGitHubProfile for GitHub platform', async () => {
      const spy = jest
        .spyOn<any, any>(service as any, 'getGitHubProfile')
        .mockResolvedValue({
          name: 'Seun Fola',
        });

      await service.getSocialProfileData('github', 'seunfola');
      expect(spy).toHaveBeenCalledWith('seunfola');
    });

    it('should throw error for unsupported platform', async () => {
      await expect(
        service.getSocialProfileData('twitter', 'seun'),
      ).rejects.toThrow('Unsupported social media platform: twitter');
    });
  });

  describe('getGitHubProfile', () => {
    it('should return structured GitHub profile data', async () => {
      httpService.get.mockReturnValue(
        of({
          data: {
            avatar_url: 'https://avatar.url',
            html_url: 'https://github.com/seun',
            name: 'Seun',
            bio: 'Software Engineer',
          },
        }) as any,
      );

      const result = await (service as any).getGitHubProfile('seun');
      expect(result).toEqual({
        profile_picture_url: 'https://avatar.url',
        github_url: 'https://github.com/seun',
        name: 'Seun',
        bio: 'Software Engineer',
      });
    });

    it('should handle invalid GitHub API response', async () => {
      httpService.get.mockReturnValue(of({ data: null }) as any);

      await expect((service as any).getGitHubProfile('seun')).rejects.toThrow(
        'Fetching GitHub profile failed:',
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      httpService.get.mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      await expect((service as any).getGitHubProfile('seun')).rejects.toThrow(
        'Fetching GitHub profile failed: Network error',
      );
    });
  });

  describe('handleError', () => {
    it('should throw formatted error message for Error instances', () => {
      expect(() =>
        (service as any).handleError('Testing', new Error('Oops')),
      ).toThrow('Testing failed: Oops');
    });

    it('should throw formatted message for unknown errors', () => {
      expect(() =>
        (service as any).handleError('Testing', { weird: true }),
      ).toThrow('Testing failed with unknown error');
    });
  });
});

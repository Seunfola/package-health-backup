import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UserPreferencesService } from '../preferences.service';
import { Model } from 'mongoose';

const mockPreferences = {
  userId: 'user1',
  dashboardMetrics: {
    codeQualityScore: true,
    testCoverage: true,
    dependencyVulnerabilities: true,
    securityAlerts: true,
  },
  notificationPreferences: {
    emailNotifications: true,
    inAppNotifications: true,
    securityAlertThreshold: 70,
    dependencyUpdateFrequency: 'daily',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UserPreferencesService (Functional)', () => {
  let service: UserPreferencesService;
  let model: Model<any>;

  const mockModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserPreferencesService,
        { provide: getModelToken('UserPreferences'), useValue: mockModel },
      ],
    }).compile();

    service = module.get<UserPreferencesService>(UserPreferencesService);
    model = module.get<Model<any>>(getModelToken('UserPreferences'));

    jest.clearAllMocks();
  });

  it('should return user preferences if exist', async () => {
    mockModel.findOne.mockResolvedValue(mockPreferences);
    const prefs = await service.getUserPreferences('user1');
    expect(prefs).toEqual(mockPreferences);
  });

  it('should create default preferences if none exist', async () => {
    mockModel.findOne.mockResolvedValue(null);
    mockModel.create.mockResolvedValue(mockPreferences);

    const prefs = await service.getUserPreferences('user1');
    expect(mockModel.create).toHaveBeenCalledWith({ userId: 'user1' });
    expect(prefs).toEqual(mockPreferences);
  });

  it('should update user preferences', async () => {
    mockModel.findOneAndUpdate.mockResolvedValue(mockPreferences);
    const prefs = await service.updateUserPreferences('user1', {
      dashboardMetrics: mockPreferences.dashboardMetrics,
      notificationPreferences: mockPreferences.notificationPreferences,
    });
    expect(mockModel.findOneAndUpdate).toHaveBeenCalled();
    expect(prefs).toEqual(mockPreferences);
  });

  it('should check notification sending rules', async () => {
    mockModel.findOne.mockResolvedValue(mockPreferences);
    expect(await service.shouldSendNotification('user1', 'email')).toBe(true);
    expect(await service.shouldSendNotification('user1', 'inApp')).toBe(true);
    expect(await service.shouldSendNotification('user1', 'other')).toBe(true);
  });

  it('should return default preferences', () => {
    const defaults = service.getDefaultPreferences();
    expect(defaults).toHaveProperty('dashboardMetrics');
    expect(defaults).toHaveProperty('notificationPreferences');
  });

    it('should return defaults if user has no preferences', async () => {
      (model.findOne as jest.Mock).mockResolvedValue(null);
      (model.create as jest.Mock).mockResolvedValue({
        userId: 'user1',
        ...service.getDefaults(),
      });

      const prefs = await service.getUserPreferences('user1');
      expect(prefs.dashboardMetrics.codeQualityScore).toBe(true);
      expect(prefs.notificationPreferences.securityAlertThreshold).toBe(70);
    });

    it('should update preferences correctly', async () => {
      const update = {
        dashboardMetrics: {
          codeQualityScore: false,
          testCoverage: true,
          dependencyVulnerabilities: true,
          securityAlerts: true,
        },
        notificationPreferences: {
          emailNotifications: false,
          inAppNotifications: true,
          securityAlertThreshold: 80,
          dependencyUpdateFrequency: 'weekly',
        },
      };
      mockModel.findOneAndUpdate.mockResolvedValue({ userId: 'user1', ...update });

      const updated = await service.updateUserPreferences('user1', update);
      expect(updated.dashboardMetrics.codeQualityScore).toBe(false);
      expect(updated.notificationPreferences.securityAlertThreshold).toBe(80);
    });
});

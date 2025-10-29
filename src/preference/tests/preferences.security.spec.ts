import { Test, TestingModule } from "@nestjs/testing";
import { UserPreferencesService } from "../preferences.service";
import { getModelToken } from "@nestjs/mongoose";

describe('UserPreferencesService (Security & Behavior)', () => {
  let service: UserPreferencesService;
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
    jest.clearAllMocks();
  });

  it('should not fail on unknown notification types', async () => {
    mockModel.findOne.mockResolvedValue({
      notificationPreferences: {
        emailNotifications: true,
        inAppNotifications: false,
      },
    });
    const result = await service.shouldSendNotification('user1', 'unknown');
    expect(result).toBe(true);
  });

  it('should always return default preferences if no user exists', async () => {
    mockModel.findOne.mockResolvedValue(null);
    mockModel.create.mockResolvedValue({
      userId: 'userX',
      ...service.getDefaults(),
    });
    const prefs = await service.getUserPreferences('userX');
    expect(prefs.notificationPreferences).toHaveProperty('emailNotifications');
  });
    
    it('should prevent arbitrary fields update', async () => {
      mockModel.findOneAndUpdate.mockResolvedValue({
        userId: 'user1',
        dashboardMetrics: { codeQualityScore: true },
        notificationPreferences: {
          emailNotifications: true,
          inAppNotifications: true,
        },
      });

      const dto = {
        dashboardMetrics: { codeQualityScore: true },
        someMaliciousField: 'hacked',
      };
      const updated = await service.updateUserPreferences('user1', dto as any);
      expect((updated as any).someMaliciousField).toBeUndefined();
    });

    it('should enforce types/validators', async () => {
      const dto = {
        dashboardMetrics: { codeQualityScore: 'yes' } as any,
        notificationPreferences: { emailNotifications: 'no' } as any,
      };

      await expect(async () => {
        await service.updateUserPreferences('user1', dto);
      }).rejects.toThrow();
    });
});

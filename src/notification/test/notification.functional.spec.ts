import { Test, TestingModule } from '@nestjs/testing';
import mongoose from 'mongoose';
import { NotificationService } from '../notification.service';
import { RepoHealthService } from '../../repo-health/services/repo-health.service';
import { UserPreferencesService } from '../../preference/preferences.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Model } from 'mongoose';

describe('NotificationService (Functional)', () => {
  let service: NotificationService;
  let notificationModel: Partial<Record<keyof Model<any>, jest.Mock>>;

  beforeAll(async () => {
    notificationModel = {
      insertMany: jest.fn().mockResolvedValue([]),
      countDocuments: jest.fn().mockResolvedValue(2),
      aggregate: jest.fn().mockResolvedValue([]),
      findByIdAndUpdate: jest.fn(),
      deleteMany: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      }),
      findByIdAndDelete: jest.fn(),
      updateMany: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: RepoHealthService,
          useValue: {
            findRepoHealth: jest.fn().mockResolvedValue({
              overall_health: 30,
              dependency_health: 40,
              security_alerts: 7,
              last_pushed: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
            }),
          },
        },
        {
          provide: UserPreferencesService,
          useValue: {
            getUserPreferences: jest.fn().mockResolvedValue({
              dashboardMetrics: {
                securityAlerts: true,
                dependencyVulnerabilities: true,
                codeQualityScore: true,
              },
              notificationPreferences: {
                inAppNotifications: true,
                emailNotifications: true,
                securityAlertThreshold: 5,
              },
            }),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn()
          },
        },
        {
          provide: 'NotificationModel',
          useValue: notificationModel,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    (service as any).notificationModel = notificationModel;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should generate multiple alerts from poor health data', async () => {
    const result = await service.generateNotificationsForRepo(
      'user',
      'repo',
      'u123',
    );
    expect(Array.isArray(result)).toBe(true);
    expect(notificationModel.insertMany).toHaveBeenCalled();
  });

  it('should mark multiple notifications as read', async () => {
    const ids = [new mongoose.Types.ObjectId().toString()];

    notificationModel.updateMany = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue({ modifiedCount: ids.length }),
  });

    const res = await service.markMultipleAsRead(ids);

    expect(res.success).toBe(true);
    expect(res.updated).toBe(ids.length);
  });

  it('should handle empty list gracefully', async () => {
    const res = await service.markMultipleAsRead([]);
    expect(res.success).toBe(true);
    expect(res.updated).toBe(0);
  });


  it('should delete multiple notifications successfully', async () => {
    notificationModel.deleteMany = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    });

    const ids = [new mongoose.Types.ObjectId().toString()];
    const res = await service.deleteMultipleNotifications(ids);

    expect(res.success).toBe(true);
    expect(res.deleted).toBe(1);
  });
});

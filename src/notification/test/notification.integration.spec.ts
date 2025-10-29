import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NotificationService } from '../notification.service';
import { NotificationSchema } from '../notification.model';
import { RepoHealthService } from 'src/repo-health/services/repo-health.service';
import { UserPreferencesService } from 'src/preference/preferences.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

describe('NotificationService (Integration)', () => {
  let service: NotificationService;
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        MongooseModule.forFeature([
          { name: 'Notification', schema: NotificationSchema },
        ]),
      ],
      providers: [
        NotificationService,
        {
          provide: RepoHealthService,
          useValue: {
            findRepoHealth: jest.fn().mockResolvedValue({
              overall_health: 55,
              dependency_health: 65,
              security_alerts: 3,
              last_pushed: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
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
                emailNotifications: false,
                securityAlertThreshold: 2,
              },
            }),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          } as unknown as Cache,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  afterEach(async () => {
    if (mongoose.connection?.db) {
      await mongoose.connection.db.dropDatabase();
    }
  });

  afterAll(async () => {
    if (mongoose.connection?.readyState) {
      await mongoose.disconnect();
    }
    await mongo.stop();
  });

  it('should generate repo notifications', async () => {
    const results = await service.generateNotificationsForRepo(
      'testUser',
      'repoHealth',
      '123',
    );

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]).toHaveProperty('repository');
    expect(results[0]).toHaveProperty('title');
  });

  it('should create and mark a notification as read', async () => {
    const notif = await service.createNotification({
      title: 'Test Alert',
      description: 'This is a test alert',
      repository: 'test/repo',
      type: 'SYSTEM_ALERT',
      priority: 'medium',
      repositoryUrl: 'https://github.com/test/repo',
      read: false,
    });

    expect(notif).toHaveProperty('_id');
    expect(notif.read).toBe(false);

    const updated = await service.markAsRead((notif as any)._id.toString());
    expect(updated).toBeDefined();
    expect(updated.read).toBe(true);
  });

  it('should return a valid notification summary', async () => {
    await Promise.all([
      service.createNotification({
        title: 'Alert A',
        description: 'A',
        repository: 'repo/A',
        type: 'SYSTEM_ALERT',
        priority: 'high',
        repositoryUrl: 'https://github.com/test/A',
        read: false,
      }),
      service.createNotification({
        title: 'Alert B',
        description: 'B',
        repository: 'repo/B',
        type: 'SECURITY_ALERT',
        priority: 'low',
        repositoryUrl: 'https://github.com/test/B',
        read: true,
      }),
    ]);

    const summary = await service.getNotificationSummary();

    expect(summary).toHaveProperty('total');
    expect(summary.total).toBeGreaterThanOrEqual(2);
    expect(summary).toHaveProperty('byType');
    expect(typeof summary.byType).toBe('object');
  });
});

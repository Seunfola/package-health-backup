import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { UserPreferencesService } from '../preferences.service';
import { Schema, Model, Connection } from 'mongoose';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';

const UserPreferencesSchema = new Schema({
  userId: { type: String, required: true },
  dashboardMetrics: { type: Object, default: {} },
  notificationPreferences: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

describe('UserPreferencesService (Integration)', () => {
  let service: UserPreferencesService;
  let mongo: MongoMemoryServer;
  let module: TestingModule;
  let model: Model<any>;
  let connection: Connection;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();

    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        MongooseModule.forFeature([
          { name: 'UserPreferences', schema: UserPreferencesSchema },
        ]),
      ],
      providers: [UserPreferencesService],
    }).compile();

    service = module.get<UserPreferencesService>(UserPreferencesService);
    model = module.get<Model<any>>(getModelToken('UserPreferences'));
    connection = module.get<Connection>(getConnectionToken());
  });

  afterAll(async () => {
    await connection.close();
    await mongo.stop();
  });

  it('should create and fetch preferences', async () => {
    const prefs = await service.getUserPreferences('user123');
    expect(prefs.userId).toBe('user123');

    const fetched = await service.getUserPreferences('user123');
    expect(fetched.userId).toBe('user123');
  });

  it('should update preferences', async () => {
    const updated = await service.updateUserPreferences('user123', {
      dashboardMetrics: {
        codeQualityScore: false,
        testCoverage: true,
        dependencyVulnerabilities: true,
        securityAlerts: false,
      },
      notificationPreferences: {
        emailNotifications: false,
        inAppNotifications: true,
        securityAlertThreshold: 50,
        dependencyUpdateFrequency: 'weekly',
      },
    });
    expect(updated.dashboardMetrics.codeQualityScore).toBe(false);
    expect(updated.notificationPreferences.securityAlertThreshold).toBe(50);
  });

  it('should reset preferences to defaults', async () => {
    await service.updateUserPreferences('user123', {
      dashboardMetrics: {
        codeQualityScore: false,
        testCoverage: false,
        dependencyVulnerabilities: false,
        securityAlerts: false,
      },
      notificationPreferences: {
        emailNotifications: false,
        inAppNotifications: false,
        securityAlertThreshold: 50,
        dependencyUpdateFrequency: 'monthly',
      },
    });

    const reset = await service.resetToDefaults('user123');
    expect(reset.dashboardMetrics.codeQualityScore).toBe(true);
    expect(reset.notificationPreferences.securityAlertThreshold).toBe(70);
  });
});

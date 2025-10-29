import mongoose from 'mongoose';
import { NotificationService } from '../notification.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UserPreferencesService } from 'src/preference/preferences.service';
import { RepoHealthService } from 'src/repo-health/services/repo-health.service';
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('NotificationService (Security)', () => {
  let service: NotificationService;
  let mockNotificationModel: any;

  beforeAll(async () => {
    mockNotificationModel = {
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: 'NotificationModel', useValue: mockNotificationModel },
        { provide: RepoHealthService, useValue: {} },
        { provide: UserPreferencesService, useValue: {} },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(NotificationService);
    (service as any).notificationModel = mockNotificationModel;
  });

  it('should throw BadRequestException for invalid ObjectId', async () => {
    await expect(service.markAsRead('invalid_id')).rejects.toThrow(
      new BadRequestException('Invalid notification ID'),
    );
  });

  it('should throw NotFoundException for missing notification', async () => {
    mockNotificationModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    });

    const id = new mongoose.Types.ObjectId().toString();
    await expect(service.markAsRead(id)).rejects.toThrow(NotFoundException);
  });

  it('should prevent invalid bulk deletion IDs', async () => {
    await expect(service.deleteMultipleNotifications(['x123'])).rejects.toThrow(
      'Invalid ID',
    );
  });
});

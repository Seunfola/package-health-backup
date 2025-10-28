import { Test, TestingModule } from '@nestjs/testing';
import { DependencyAnalysisService } from '../services/dependency-analysis.service';
import { DependencyAnalyzerService } from '../dependency-analyzer.service';
import { HttpException } from '@nestjs/common';
import { Readable } from 'stream';

describe('DependencyAnalysisService', () => {
  let service: DependencyAnalysisService;
  let analyzer: DependencyAnalyzerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DependencyAnalysisService,
        {
          provide: DependencyAnalyzerService,
          useValue: {
            analyzeDependencies: jest.fn((input?: any) => {
              if (typeof input === 'string' && input === '{ invalid json }') {
                return Promise.reject(new HttpException('Invalid JSON', 400));
              }
              if (input?.originalname?.endsWith('.txt')) {
                return Promise.reject(
                  new HttpException('Unsupported file type', 400),
                );
              }
              return Promise.resolve({
                dependencyHealth: 85,
                riskyDependencies: ['vuln-pkg@1.0.0'],
                bundleSize: 1024,
              });
            }),
          },
        },
      ],
    }).compile();

    service = module.get<DependencyAnalysisService>(DependencyAnalysisService);
    analyzer = module.get<DependencyAnalyzerService>(DependencyAnalyzerService);
  });

  it('should analyze dependencies from JSON object', async () => {
    const input = {
      dependencies: { lodash: '4.17.21' },
    };
    const fileInput: any = {
      buffer: Buffer.from(JSON.stringify(input)),
      originalname: 'package.json',
      mimetype: 'application/json',
      size: Buffer.byteLength(JSON.stringify(input)),
      encoding: '7bit',
      fieldname: 'file',
      destination: '',
      filename: '',
      path: '',
      stream: Readable.from([]),
    };
    const result = await service.analyzeDependencies(fileInput);
    expect(result.dependencyHealth).toBe(85);
    expect(result.riskyDependencies).toContain('vuln-pkg@1.0.0');
  });

  it('should analyze dependencies from JSON string', async () => {
    const input = JSON.stringify({ dependencies: { axios: '1.4.0' } });
    const fileInput: any = {
      buffer: Buffer.from(input),
      originalname: 'package.json',
      mimetype: 'application/json',
      size: Buffer.byteLength(input),
      encoding: '7bit',
      fieldname: 'file',
      destination: '',
      filename: '',
      path: '',
      stream: Readable.from([]),
    };
    const result = await service.analyzeDependencies(fileInput);
    expect(result.bundleSize).toBe(1024);
  });

  it('should throw HttpException for invalid JSON', async () => {
    const invalidJson = '{ invalid json }';
    const fileInput: any = {
      buffer: Buffer.from(invalidJson),
      originalname: 'package.json',
      mimetype: 'application/json',
      size: Buffer.byteLength(invalidJson),
      encoding: '7bit',
      fieldname: 'file',
      destination: '',
      filename: '',
      path: '',
      stream: Readable.from([]),
    };
    await expect(service.analyzeDependencies(fileInput)).rejects.toThrow(
      HttpException,
    );
  });

  it('should throw HttpException for unsupported file types', async () => {
    const file: any = {
      buffer: Buffer.from('test'),
      originalname: 'test.txt',
      mimetype: 'text/plain',
      size: 4,
      encoding: '7bit',
      fieldname: 'file',
      destination: '',
      filename: '',
      path: '',
      stream: Readable.from([]),
    };
    await expect(service.analyzeDependencies(file)).rejects.toThrow(
      HttpException,
    );
  });

  it('should call analyzer.analyzeDependencies', async () => {
    const spy = jest.spyOn(analyzer, 'analyzeDependencies');
    const file: any = {
      buffer: Buffer.from(
        JSON.stringify({ dependencies: { lodash: '4.17.21' } }),
      ),
      originalname: 'package.json',
      mimetype: 'application/json',
      size: Buffer.byteLength(
        JSON.stringify({ dependencies: { lodash: '4.17.21' } }),
      ),
      encoding: '7bit',
      fieldname: 'file',
      destination: '',
      filename: '',
      path: '',
      stream: Readable.from([]),
    };
    await service.analyzeDependencies(file);
    expect(spy).toHaveBeenCalled();
  });

  it('should return default analysis if no input is provided', async () => {
    const result = await service.analyzeDependencies();
    expect(result.dependencyHealth).toBe(100);
    expect(result.riskyDependencies).toEqual([]);
  });
});

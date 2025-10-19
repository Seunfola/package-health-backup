import { createMockModel } from '../../script/package-health';

describe('createMockModel', () => {
  const mockModel = createMockModel();

  test('findOne().exec() should return null', async () => {
    const result = await mockModel.findOne().exec();
    expect(result).toBeNull();
  });

  test('findOneAndUpdate().exec() should return a document', async () => {
    const result = await mockModel.findOneAndUpdate().exec();
    expect(result).toHaveProperty('repo_id');
  });

  test('find().exec() should return an array', async () => {
    const result = await mockModel.find().exec();
    expect(Array.isArray(result)).toBe(true);
  });

  test('create() should return a document', async () => {
    const doc = await mockModel.create();
    expect(doc).toHaveProperty('overall_health');
  });

  test('lean() should be chainable', () => {
    const chain = mockModel.find().lean();
    expect(chain).toHaveProperty('exec');
  });
});

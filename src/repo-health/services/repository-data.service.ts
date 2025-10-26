import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RepoHealth, RepoHealthDocument } from '../repo-health.model';

@Injectable()
export class RepositoryDataService {
  private readonly logger = new Logger(RepositoryDataService.name);

  constructor(
    @InjectModel(RepoHealth.name)
    private readonly repoHealthModel: Model<RepoHealthDocument>,
  ) {}

  async findOne(repo_id: string): Promise<RepoHealthDocument | null> {
    return this.repoHealthModel.findOne({ repo_id }).exec();
  }

  async findByOwner(owner: string): Promise<RepoHealthDocument[]> {
    return this.repoHealthModel
      .find({ owner })
      .sort('-overall_health.score')
      .exec();
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    sort: string = '-overall_health.score',
  ): Promise<{
    data: RepoHealthDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.repoHealthModel.find().sort(sort).skip(skip).limit(limit).exec(),
      this.repoHealthModel.countDocuments().exec(),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async upsertRepoHealth(
    repo_id: string,
    updateData: any,
  ): Promise<RepoHealthDocument> {
    return this.repoHealthModel.findOneAndUpdate({ repo_id }, updateData, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });
  }

  async deleteRepo(repo_id: string): Promise<boolean> {
    const result = await this.repoHealthModel.deleteOne({ repo_id }).exec();
    return result.deletedCount > 0;
  }

  async getStats(): Promise<{
    totalRepos: number;
    averageHealth: number;
    healthDistribution: {
      excellent: number;
      good: number;
      moderate: number;
      poor: number;
    };
  }> {
    const allRepos = await this.repoHealthModel.find().exec();

    if (allRepos.length === 0) {
      return {
        totalRepos: 0,
        averageHealth: 0,
        healthDistribution: { excellent: 0, good: 0, moderate: 0, poor: 0 },
      };
    }

    const totalHealth = allRepos.reduce(
      (sum, repo) => sum + (repo.overall_health?.score ?? 0),
      0,
    );
    const averageHealth = totalHealth / allRepos.length;

    const healthDistribution = {
      excellent: allRepos.filter(
        (repo) => (repo.overall_health?.score ?? 0) >= 80,
      ).length,
      good: allRepos.filter(
        (repo) =>
          (repo.overall_health?.score ?? 0) >= 60 &&
          (repo.overall_health?.score ?? 0) < 80,
      ).length,
      moderate: allRepos.filter(
        (repo) =>
          (repo.overall_health?.score ?? 0) >= 40 &&
          (repo.overall_health?.score ?? 0) < 60,
      ).length,
      poor: allRepos.filter((repo) => (repo.overall_health?.score ?? 0) < 40)
        .length,
    };

    return {
      totalRepos: allRepos.length,
      averageHealth: Math.round(averageHealth * 100) / 100,
      healthDistribution,
    };
  }
}

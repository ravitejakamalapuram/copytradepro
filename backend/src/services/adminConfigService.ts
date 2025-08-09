import mongoose from 'mongoose';
import { getAdminSettingModel } from '../models/adminConfigModels';
import { logger } from '../utils/logger';

export type AdminConfigKey = 'searchRankingWeights';

export class AdminConfigService {
  private AdminSettingModel = getAdminSettingModel(mongoose.connection);

  async get<T = any>(key: AdminConfigKey): Promise<T | null> {
    try {
      const doc = await this.AdminSettingModel.findOne({ key }).lean();
      return (doc?.value as T) ?? null;
    } catch (e) {
      logger.error('Failed to get admin setting', { component: 'ADMIN_CONFIG', key }, e);
      return null;
    }
  }

  async set<T = any>(key: AdminConfigKey, value: T): Promise<boolean> {
    try {
      await this.AdminSettingModel.updateOne(
        { key },
        { $set: { value, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      );
      logger.info('Admin setting updated', { component: 'ADMIN_CONFIG', key });
      return true;
    } catch (e) {
      logger.error('Failed to set admin setting', { component: 'ADMIN_CONFIG', key }, e);
      return false;
    }
  }
}

export const adminConfigService = new AdminConfigService();


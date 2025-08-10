/**
 * Database wrapper that automatically includes trace context for all operations
 */

import mongoose, { Model, Document, FilterQuery, UpdateQuery, QueryOptions } from 'mongoose';
import { TraceContext } from './traceContext';
import { logger } from './logger';

export class TracedDatabase {
  /**
   * Find documents with trace context
   */
  static async find<T extends Document>(
    model: Model<T>,
    filter: FilterQuery<T> = {},
    options?: QueryOptions
  ): Promise<T[]> {
    return TraceContext.withDatabaseTrace(
      'FIND_DOCUMENTS',
      async () => {
        const query = model.find(filter, null, options);
        return await query.exec();
      },
      {
        modelName: model.modelName,
        filterKeys: Object.keys(filter),
        hasOptions: !!options
      }
    );
  }

  /**
   * Find one document with trace context
   */
  static async findOne<T extends Document>(
    model: Model<T>,
    filter: FilterQuery<T>,
    options?: QueryOptions
  ): Promise<T | null> {
    return TraceContext.withDatabaseTrace(
      'FIND_ONE_DOCUMENT',
      async () => {
        const query = model.findOne(filter, null, options);
        return await query.exec();
      },
      {
        modelName: model.modelName,
        filterKeys: Object.keys(filter),
        hasOptions: !!options
      }
    );
  }

  /**
   * Find by ID with trace context
   */
  static async findById<T extends Document>(
    model: Model<T>,
    id: string | mongoose.Types.ObjectId,
    options?: QueryOptions
  ): Promise<T | null> {
    return TraceContext.withDatabaseTrace(
      'FIND_BY_ID',
      async () => {
        const query = model.findById(id, null, options);
        return await query.exec();
      },
      {
        modelName: model.modelName,
        documentId: id.toString(),
        hasOptions: !!options
      }
    );
  }

  /**
   * Create document with trace context
   */
  static async create<T extends Document>(
    model: Model<T>,
    data: any
  ): Promise<T> {
    return TraceContext.withDatabaseTrace(
      'CREATE_DOCUMENT',
      async () => {
        return await model.create(data);
      },
      {
        modelName: model.modelName,
        dataKeys: Object.keys(data)
      }
    );
  }

  /**
   * Update one document with trace context
   */
  static async updateOne<T extends Document>(
    model: Model<T>,
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: any
  ): Promise<any> {
    return TraceContext.withDatabaseTrace(
      'UPDATE_ONE_DOCUMENT',
      async () => {
        return await model.updateOne(filter, update, options);
      },
      {
        modelName: model.modelName,
        filterKeys: Object.keys(filter),
        updateKeys: Object.keys(update),
        hasOptions: !!options
      }
    );
  }

  /**
   * Update many documents with trace context
   */
  static async updateMany<T extends Document>(
    model: Model<T>,
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: any
  ): Promise<any> {
    return TraceContext.withDatabaseTrace(
      'UPDATE_MANY_DOCUMENTS',
      async () => {
        return await model.updateMany(filter, update, options);
      },
      {
        modelName: model.modelName,
        filterKeys: Object.keys(filter),
        updateKeys: Object.keys(update),
        hasOptions: !!options
      }
    );
  }

  /**
   * Delete one document with trace context
   */
  static async deleteOne<T extends Document>(
    model: Model<T>,
    filter: FilterQuery<T>,
    options?: any
  ): Promise<any> {
    return TraceContext.withDatabaseTrace(
      'DELETE_ONE_DOCUMENT',
      async () => {
        return await model.deleteOne(filter, options);
      },
      {
        modelName: model.modelName,
        filterKeys: Object.keys(filter),
        hasOptions: !!options
      }
    );
  }

  /**
   * Delete many documents with trace context
   */
  static async deleteMany<T extends Document>(
    model: Model<T>,
    filter: FilterQuery<T>,
    options?: any
  ): Promise<any> {
    return TraceContext.withDatabaseTrace(
      'DELETE_MANY_DOCUMENTS',
      async () => {
        return await model.deleteMany(filter, options);
      },
      {
        modelName: model.modelName,
        filterKeys: Object.keys(filter),
        hasOptions: !!options
      }
    );
  }

  /**
   * Count documents with trace context
   */
  static async countDocuments<T extends Document>(
    model: Model<T>,
    filter: FilterQuery<T> = {}
  ): Promise<number> {
    return TraceContext.withDatabaseTrace(
      'COUNT_DOCUMENTS',
      async () => {
        return await model.countDocuments(filter);
      },
      {
        modelName: model.modelName,
        filterKeys: Object.keys(filter)
      }
    );
  }

  /**
   * Aggregate with trace context
   */
  static async aggregate<T extends Document>(
    model: Model<T>,
    pipeline: any[],
    options?: any
  ): Promise<any[]> {
    return TraceContext.withDatabaseTrace(
      'AGGREGATE_DOCUMENTS',
      async () => {
        return await model.aggregate(pipeline, options);
      },
      {
        modelName: model.modelName,
        pipelineStages: pipeline.length,
        hasOptions: !!options
      }
    );
  }

  /**
   * Find one and update with trace context
   */
  static async findOneAndUpdate<T extends Document>(
    model: Model<T>,
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: QueryOptions
  ): Promise<T | null> {
    return TraceContext.withDatabaseTrace(
      'FIND_ONE_AND_UPDATE',
      async () => {
        return await model.findOneAndUpdate(filter, update, options);
      },
      {
        modelName: model.modelName,
        filterKeys: Object.keys(filter),
        updateKeys: Object.keys(update),
        hasOptions: !!options
      }
    );
  }

  /**
   * Find one and delete with trace context
   */
  static async findOneAndDelete<T extends Document>(
    model: Model<T>,
    filter: FilterQuery<T>,
    options?: QueryOptions
  ): Promise<T | null> {
    return TraceContext.withDatabaseTrace(
      'FIND_ONE_AND_DELETE',
      async () => {
        return await model.findOneAndDelete(filter, options);
      },
      {
        modelName: model.modelName,
        filterKeys: Object.keys(filter),
        hasOptions: !!options
      }
    );
  }

  /**
   * Execute raw query with trace context
   */
  static async executeQuery<T>(
    operation: string,
    queryFunction: () => Promise<T>,
    metadata?: any
  ): Promise<T> {
    return TraceContext.withDatabaseTrace(
      operation,
      queryFunction,
      metadata
    );
  }
}

export default TracedDatabase;
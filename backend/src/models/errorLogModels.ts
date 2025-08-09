import { Schema, model, Document } from 'mongoose';

// Error Log Entry Interface
export interface IErrorLog extends Document {
  errorId: string;
  traceId: string;
  timestamp: Date;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  source: 'UI' | 'BE' | 'DB' | 'API';
  component: string;
  operation: string;
  message: string;
  errorType: string;
  stackTrace?: string;
  context: {
    requestId?: string;
    userId?: string;
    sessionId?: string;
    userAgent?: string;
    ipAddress?: string;
    brokerName?: string;
    accountId?: string;
    url?: string;
    method?: string;
    statusCode?: number;
    duration?: number;
    retryCount?: number;
  };
  metadata: {
    environment: string;
    version: string;
    nodeVersion: string;
    platform: string;
  };
  relatedErrors?: string[];
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Trace Lifecycle Interface
export interface ITraceLifecycle extends Document {
  traceId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'SUCCESS' | 'ERROR' | 'PENDING';
  operations: Array<{
    operation: string;
    component: string;
    startTime: Date;
    endTime?: Date;
    status: 'SUCCESS' | 'ERROR' | 'PENDING';
    metadata?: any;
  }>;
  errorCount: number;
  warningCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Error Log Schema
const ErrorLogSchema = new Schema<IErrorLog>({
  errorId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  traceId: { 
    type: String, 
    required: true, 
    index: true 
  },
  timestamp: { 
    type: Date, 
    required: true, 
    index: true,
    default: Date.now
  },
  level: { 
    type: String, 
    enum: ['ERROR', 'WARN', 'INFO', 'DEBUG'], 
    required: true,
    index: true
  },
  source: { 
    type: String, 
    enum: ['UI', 'BE', 'DB', 'API'], 
    required: true,
    index: true
  },
  component: { 
    type: String, 
    required: true, 
    index: true 
  },
  operation: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  errorType: { 
    type: String, 
    required: true, 
    index: true 
  },
  stackTrace: { 
    type: String 
  },
  context: {
    requestId: { type: String, index: true },
    userId: { type: String, index: true },
    sessionId: { type: String, index: true },
    userAgent: String,
    ipAddress: String,
    brokerName: { type: String, index: true },
    accountId: String,
    url: String,
    method: String,
    statusCode: Number,
    duration: Number,
    retryCount: { type: Number, default: 0 }
  },
  metadata: {
    environment: { type: String, required: true },
    version: { type: String, required: true },
    nodeVersion: String,
    platform: String
  },
  relatedErrors: [{ type: String }],
  resolved: { 
    type: Boolean, 
    default: false,
    index: true
  },
  resolvedAt: Date,
  resolvedBy: String,
  resolution: String
}, {
  timestamps: true,
  collection: 'error_logs'
});

// Compound indexes for efficient querying
ErrorLogSchema.index({ timestamp: -1, level: 1 });
ErrorLogSchema.index({ traceId: 1, timestamp: 1 });
ErrorLogSchema.index({ component: 1, errorType: 1, timestamp: -1 });
ErrorLogSchema.index({ 'context.userId': 1, timestamp: -1 });
ErrorLogSchema.index({ 'context.brokerName': 1, timestamp: -1 });
ErrorLogSchema.index({ source: 1, level: 1, timestamp: -1 });
ErrorLogSchema.index({ resolved: 1, timestamp: -1 });

// Text index for full-text search
ErrorLogSchema.index({ 
  message: 'text', 
  'context.operation': 'text',
  component: 'text',
  errorType: 'text'
});

// Trace Lifecycle Schema
const TraceLifecycleSchema = new Schema<ITraceLifecycle>({
  traceId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  startTime: { 
    type: Date, 
    required: true,
    index: true
  },
  endTime: Date,
  duration: Number,
  status: { 
    type: String, 
    enum: ['SUCCESS', 'ERROR', 'PENDING'], 
    required: true,
    default: 'PENDING',
    index: true
  },
  operations: [{
    operation: { type: String, required: true },
    component: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: Date,
    status: { 
      type: String, 
      enum: ['SUCCESS', 'ERROR', 'PENDING'], 
      required: true,
      default: 'PENDING'
    },
    metadata: Schema.Types.Mixed
  }],
  errorCount: { 
    type: Number, 
    default: 0,
    index: true
  },
  warningCount: { 
    type: Number, 
    default: 0 
  }
}, {
  timestamps: true,
  collection: 'trace_lifecycles'
});

// Additional indexes for trace lifecycle
TraceLifecycleSchema.index({ startTime: -1, status: 1 });
TraceLifecycleSchema.index({ status: 1, errorCount: -1 });
TraceLifecycleSchema.index({ duration: -1 });

// Export models
export const ErrorLog = model<IErrorLog>('ErrorLog', ErrorLogSchema);
export const TraceLifecycle = model<ITraceLifecycle>('TraceLifecycle', TraceLifecycleSchema);
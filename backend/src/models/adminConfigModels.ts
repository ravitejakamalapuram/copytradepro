import mongoose, { Schema, Document, Model } from 'mongoose';

export interface AdminSettingDocument extends Document {
  key: string;
  value: any;
  updatedAt: Date;
  createdAt: Date;
}

const AdminSettingSchema = new Schema<AdminSettingDocument>({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

AdminSettingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const getAdminSettingModel = (connection: mongoose.Connection): Model<AdminSettingDocument> => {
  return connection.model<AdminSettingDocument>('AdminSetting', AdminSettingSchema);
};


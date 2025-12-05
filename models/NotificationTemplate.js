import mongoose from 'mongoose';

const notificationTemplateSchema = new mongoose.Schema(
  {
    service: {
      type: String,
      enum: ['Live Show', 'Video Call', 'Dedication', 'General'],
      required: true,
      index: true
    },
    notificationType: {
      type: String,
      enum: ['Push', 'SMS', 'Email'],
      required: true,
      index: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: ['Video Calls', 'Dedications', 'Live Shows', 'General'],
      default: 'General',
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    lastUsedAt: {
      type: Date
    },
    usageCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Indexes for better query performance
notificationTemplateSchema.index({ service: 1, notificationType: 1 });
notificationTemplateSchema.index({ category: 1, notificationType: 1 });
notificationTemplateSchema.index({ createdBy: 1 });

const NotificationTemplate = mongoose.model('NotificationTemplate', notificationTemplateSchema);

export default NotificationTemplate;


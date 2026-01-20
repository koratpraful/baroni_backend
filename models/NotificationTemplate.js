import mongoose from 'mongoose';

const notificationTemplateSchema = new mongoose.Schema(
  {
    service: {
      type: String,
      // Keep legacy labels for backward compatibility, but prefer lowercase keys going forward
      enum: ['Live Show', 'Video Call', 'Dedication', 'General', 'live_show', 'video_call', 'dedication', 'general'],
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
      // New canonical keys: lowercase, no spaces
      // Legacy values kept to avoid breaking existing data
      enum: [
        'video_calls',
        'dedications',
        'live_shows',
        'general',
        'Video Calls',
        'Dedications',
        'Live Shows',
        'General'
      ],
      default: 'general',
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


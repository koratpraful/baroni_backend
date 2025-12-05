import mongoose from 'mongoose';

const scheduledNotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    body: {
      type: String,
      required: true,
      trim: true
    },
    notificationType: {
      type: String,
      enum: ['Push', 'SMS', 'Email'],
      required: true,
      index: true
    },
    sessionTitle: {
      type: String,
      trim: true
    },
    targetAudience: {
      type: String,
      enum: ['All Fans', 'All Stars', 'All Users', 'Specific Users', 'By Country'],
      required: true,
      index: true
    },
    country: {
      type: String,
      trim: true
    },
    userIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    scheduledAt: {
      type: Date,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['scheduled', 'sent', 'cancelled', 'failed'],
      default: 'scheduled',
      index: true
    },
    sentAt: {
      type: Date
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    sentCount: {
      type: Number,
      default: 0
    },
    failedCount: {
      type: Number,
      default: 0
    },
    failureReason: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// Indexes for better query performance
scheduledNotificationSchema.index({ scheduledAt: 1, status: 1 });
scheduledNotificationSchema.index({ createdBy: 1 });
scheduledNotificationSchema.index({ status: 1 });

const ScheduledNotification = mongoose.model('ScheduledNotification', scheduledNotificationSchema);

export default ScheduledNotification;


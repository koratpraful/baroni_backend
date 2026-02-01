import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    starId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fanId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    availabilityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Availability', required: true, index: true },
    timeSlotId: { type: mongoose.Schema.Types.ObjectId, required: true },
    date: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    utcStartTime: { type: Date, index: true }, // UTC time for appointment start (calculated from local time based on country)
    price: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'approved', 'in_progress', 'rejected', 'cancelled', 'completed', 'rescheduled', 'missed'], default: 'pending', index: true },
    // Tracks the lifecycle of the payment linked to this appointment
    // initiated -> hybrid external part initiated
    // pending -> full payment (coin only) or external part completed and funds in escrow
    // completed -> payment released upon appointment completion
    // refunded -> coins refunded due to cancellation/timeout
    paymentStatus: { type: String, enum: ['initiated', 'pending', 'completed', 'refunded'], default: 'pending', index: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
    externalPaymentId: { type: String, index: true },
    coinAmountReserved: { type: Number, min: 0, default: 0 },
    completedAt: { type: Date },
    callDuration: { type: Number, min: 0 }, // Duration in seconds
    // Reminder tracking
    reminderSent: { type: Boolean, default: false, index: true },
    reminderSentAt: { type: Date },
    // Reschedule fields
    isRescheduled: { type: Boolean, default: false, index: true },
    parentAppointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null, index: true },
    referenceAppointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null, index: true }, // Reference to the appointment that was rescheduled
    // Review pending flag - true when appointment is completed but fan hasn't given review yet
    is_appointment_pending: { type: Boolean, default: false, index: true },
    // Agora Cloud Recording fields
    recordingResourceId: { type: String, default: null }, // Resource ID from Agora acquire
    recordingSid: { type: String, default: null }, // Recording session ID from Agora start
    recordingStatus: { type: String, enum: ['not_started', 'acquired', 'recording', 'stopped', 'failed'], default: 'not_started' },
    recordingFiles: [{ 
      fileName: String,
      trackType: String, // 'audio', 'video', 'audio_and_video'
      uid: String,
      mixedAllUser: Boolean,
      isPlayable: Boolean,
      sliceStartTime: Number
    }],
    recordingStartedAt: { type: Date },
    recordingStoppedAt: { type: Date },
  },
  { timestamps: true }
);

appointmentSchema.index({ starId: 1, date: 1 });
appointmentSchema.index({ transactionId: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;







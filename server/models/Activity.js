const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
      index: true
    },
    taskTitle: {
      type: String,
      default: ''
    },
    action: {
      type: String,
      enum: [
        'created',
        'updated',
        'status_changed',
        'priority_changed',
        'completed',
        'duplicated',
        'archived',
        'restored',
        'deleted',
        'timer_recorded',
        'note_added',
        'note_deleted'
      ],
      required: true
    },
    details: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

ActivitySchema.index({ taskId: 1, createdAt: -1 });
ActivitySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', ActivitySchema);

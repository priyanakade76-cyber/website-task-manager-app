const mongoose = require('mongoose');

const NoteSubSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, 'Note content cannot be empty'],
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const TaskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: ['Todo', 'In Progress', 'Completed', 'Archived'],
      default: 'Todo',
      index: true
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
      index: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true
    },
    categoryName: {
      type: String,
      default: 'General'
    },
    categoryColor: {
      type: String,
      default: '#6366f1'
    },
    tags: {
      type: [String],
      default: [],
      index: true
    },
    dueDate: {
      type: Date,
      default: null,
      index: true
    },
    dueTime: {
      type: String,
      default: '12:00'
    },
    reminderTime: {
      type: Number,
      default: 30 // minutes before due date
    },
    estimatedTime: {
      type: Number,
      default: 0 // in minutes
    },
    actualTime: {
      type: Number,
      default: 0 // in seconds
    },
    recurring: {
      isRecurring: {
        type: Boolean,
        default: false
      },
      frequency: {
        type: String,
        enum: ['None', 'Daily', 'Weekly', 'Monthly', 'Custom'],
        default: 'None'
      },
      intervalDays: {
        type: Number,
        default: 1
      },
      nextOccurrence: {
        type: Date,
        default: null
      }
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true
    },
    completedAt: {
      type: Date,
      default: null
    },
    pomodoroSessions: {
      type: Number,
      default: 0
    },
    order: {
      type: Number,
      default: 0
    },
    notes: [NoteSubSchema]
  },
  {
    timestamps: true
  }
);

// Indexes for fast searching and filtering
TaskSchema.index({ userId: 1, status: 1, dueDate: 1 });
TaskSchema.index({ userId: 1, priority: 1 });
TaskSchema.index({ userId: 1, isArchived: 1 });
TaskSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Task', TaskSchema);

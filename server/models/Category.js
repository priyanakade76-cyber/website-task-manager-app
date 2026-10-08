const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Please provide category name'],
      trim: true,
      maxlength: [30, 'Category name cannot exceed 30 characters']
    },
    color: {
      type: String,
      default: '#6366f1',
      match: [/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Please provide a valid hex color']
    },
    icon: {
      type: String,
      default: 'fa-folder'
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Compound index to ensure uniqueness of category name per user
CategorySchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', CategorySchema);

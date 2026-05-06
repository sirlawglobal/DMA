import mongoose from 'mongoose';

const BatchSchema = new mongoose.Schema({
  batchId: {
    type: String,
    required: true,
    unique: true,
  },
  personInCharge: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Released', 'In Transit', 'Delivered'],
    default: 'Released',
  },
  totalRecords: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.Batch || mongoose.model('Batch', BatchSchema);

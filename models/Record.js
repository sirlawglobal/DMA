import mongoose from 'mongoose';

const RecordSchema = new mongoose.Schema({
  serialNumber: {
    type: String,
    default: '',
  },
  waybill: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    default: '',
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
  batchId: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.Record || mongoose.model('Record', RecordSchema);

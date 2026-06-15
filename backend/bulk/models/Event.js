const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  eventName: { type: String, required: true },
  eventDate: { type: Date },
  venue: { type: String, default: '' },
  organizerName: { type: String, default: '' },
  mode: { type: String, enum: ['PLANNING', 'LIVE'], default: 'PLANNING' },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);

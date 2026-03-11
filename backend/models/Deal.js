const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema({
  buyer:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seller:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },

  amount:       { type: Number, required: true },
  sellerAmount: { type: Number, required: true },
  commission:   { type: Number, required: true },

  status: {
    type: String,
    enum: ['pending','paid','active','completed','disputed','cancelled','refunded'],
    default: 'pending'
  },

  messages: [{
    sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text:      { type: String },
    isSystem:  { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
  }],

  deliveryData:     { type: String },
  deliveredAt:      { type: Date },
  buyerConfirmed:   { type: Boolean, default: false },
  sellerConfirmed:  { type: Boolean, default: false },
  autoCompleteAt:   { type: Date },

  adminNote:   { type: String },
  resolvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt:  { type: Date },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Deal', dealSchema);

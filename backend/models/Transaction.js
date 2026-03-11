const mongoose = require('mongoose');

const txSchema = new mongoose.Schema({
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:   { type: String, enum: ['deposit','withdrawal','purchase','sale','refund','commission','freeze','unfreeze','adjustment'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  status:   { type: String, enum: ['pending','completed','failed','cancelled'], default: 'pending' },
  description: { type: String },
  deal:     { type: mongoose.Schema.Types.ObjectId, ref: 'Deal' },

  // Payment gateway data
  gatewayType:     { type: String }, // 'rukassa' | 'cryptocloud' | 'cryptobot'
  gatewayInvoiceId:{ type: String },
  gatewayPayUrl:   { type: String },
  gatewayOrderId:  { type: String },

  balanceBefore: { type: Number },
  balanceAfter:  { type: Number },

  createdAt: { type: Date, default: Date.now }
});

txSchema.index({ user: 1, createdAt: -1 });
txSchema.index({ gatewayOrderId: 1 });

module.exports = mongoose.model('Transaction', txSchema);

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  seller:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:       { type: String, required: true, maxlength: 120 },
  description: { type: String, required: true, maxlength: 3000 },
  price:       { type: Number, required: true, min: 0 },
  category:    { type: String, required: true },
  subcategory: { type: String },
  images:      [{ type: String }],

  // Digital delivery
  deliveryData: { type: String }, // hidden until deal complete
  deliveryType: { type: String, enum: ['auto', 'manual'], default: 'manual' },

  // Game specific
  game:   { type: String },
  server: { type: String },

  status: {
    type: String,
    enum: ['active', 'sold', 'frozen', 'deleted', 'moderation'],
    default: 'active'
  },

  views:      { type: Number, default: 0 },
  favorites:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  tags:       [{ type: String }],
  isPromoted: { type: Boolean, default: false },
  promotedUntil: { type: Date },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

productSchema.index({ title: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, status: 1, createdAt: -1 });
productSchema.index({ seller: 1, status: 1 });

module.exports = mongoose.model('Product', productSchema);

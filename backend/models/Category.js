const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name:     { type: String, required: true },
  slug:     { type: String, required: true, unique: true },
  icon:     { type: String },
  parent:   { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  order:    { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Category', categorySchema);

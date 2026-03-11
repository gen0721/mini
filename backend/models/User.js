const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Auth
  username:  { type: String, unique: true, sparse: true, trim: true },
  password:  { type: String },
  telegramId:{ type: String, unique: true, sparse: true },

  // OTP (one-time code via bot)
  otpCode:     { type: String },
  otpExpires:  { type: Date },
  otpUsed:     { type: Boolean, default: false },

  // Profile
  firstName:  { type: String },
  lastName:   { type: String },
  photoUrl:   { type: String },
  bio:        { type: String, maxlength: 300 },

  // Wallet
  balance:        { type: Number, default: 0 },
  frozenBalance:  { type: Number, default: 0 },
  totalDeposited: { type: Number, default: 0 },
  totalWithdrawn: { type: Number, default: 0 },

  // Stats
  totalSales:     { type: Number, default: 0 },
  totalPurchases: { type: Number, default: 0 },
  rating:         { type: Number, default: 5.0 },
  reviewCount:    { type: Number, default: 0 },

  // Roles
  isAdmin:     { type: Boolean, default: false },
  isSubAdmin:  { type: Boolean, default: false },
  isVerified:  { type: Boolean, default: false },

  // Status
  isBanned:    { type: Boolean, default: false },
  bannedUntil: { type: Date },
  banReason:   { type: String },

  // Reset password
  resetCode:    { type: String },
  resetExpires: { type: Date },

  createdAt:  { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

userSchema.methods.comparePassword = function(pwd) {
  return bcrypt.compare(pwd, this.password);
};

module.exports = mongoose.model('User', userSchema);

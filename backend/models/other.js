const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Deal = sequelize.define('Deal', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  buyerId:    { type: DataTypes.UUID, allowNull: false },
  sellerId:   { type: DataTypes.UUID, allowNull: false },
  productId:  { type: DataTypes.UUID, allowNull: false },
  amount:     { type: DataTypes.DECIMAL(18,2), allowNull: false },
  commission: { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  status:     { type: DataTypes.ENUM('pending','active','delivered','completed','disputed','refunded','cancelled'), defaultValue: 'pending' },
  disputeReason: { type: DataTypes.TEXT, allowNull: true },
  disputeBy:  { type: DataTypes.UUID, allowNull: true },
  resolvedBy: { type: DataTypes.UUID, allowNull: true },
  deliveredContent: { type: DataTypes.TEXT, allowNull: true },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  autoCloseAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'Deals', timestamps: true });

const Transaction = sequelize.define('Transaction', {
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId:        { type: DataTypes.UUID, allowNull: false },
  type:          { type: DataTypes.ENUM('deposit','withdrawal','deal_payment','deal_received','commission','refund','adjustment','freeze','unfreeze'), allowNull: false },
  amount:        { type: DataTypes.DECIMAL(18,2), allowNull: false },
  currency:      { type: DataTypes.STRING(10), defaultValue: 'USD' },
  status:        { type: DataTypes.ENUM('pending','completed','failed'), defaultValue: 'pending' },
  description:   { type: DataTypes.TEXT, allowNull: true },
  invoiceId:     { type: DataTypes.STRING, allowNull: true },
  payUrl:        { type: DataTypes.TEXT, allowNull: true },
  transferId:    { type: DataTypes.STRING, allowNull: true },
  balanceBefore: { type: DataTypes.DECIMAL(18,2), allowNull: true },
  balanceAfter:  { type: DataTypes.DECIMAL(18,2), allowNull: true },
  dealId:        { type: DataTypes.UUID, allowNull: true },
  gateway:       { type: DataTypes.STRING(50), allowNull: true },
}, { tableName: 'Transactions', timestamps: true });

const Review = sequelize.define('Review', {
  id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  dealId:    { type: DataTypes.UUID, allowNull: false },
  productId: { type: DataTypes.UUID, allowNull: false },
  reviewerId: { type: DataTypes.UUID, allowNull: false },
  sellerId:  { type: DataTypes.UUID, allowNull: false },
  rating:    { type: DataTypes.INTEGER, allowNull: false },
  comment:   { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'Reviews', timestamps: true });

const TelegramCode = sequelize.define('TelegramCode', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  telegramId: { type: DataTypes.STRING, allowNull: false },
  username:   { type: DataTypes.STRING, allowNull: true },
  code:       { type: DataTypes.STRING(8), allowNull: false },
  type:       { type: DataTypes.ENUM('register','reset'), defaultValue: 'register' },
  used:       { type: DataTypes.BOOLEAN, defaultValue: false },
  expiresAt:  { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'TelegramCodes', timestamps: true });

const Message = sequelize.define('Message', {
  id:       { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  dealId:   { type: DataTypes.UUID, allowNull: false },
  senderId: { type: DataTypes.UUID, allowNull: false },
  text:     { type: DataTypes.TEXT, allowNull: true },
  fileUrl:  { type: DataTypes.STRING, allowNull: true },
  fileType: { type: DataTypes.STRING, allowNull: true },
  isRead:   { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'Messages', timestamps: true });

const Favorite = sequelize.define('Favorite', {
  id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId:    { type: DataTypes.UUID, allowNull: false },
  productId: { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'Favorites', timestamps: true });

module.exports = { Deal, Transaction, Review, TelegramCode, Message, Favorite };

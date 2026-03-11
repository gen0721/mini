const sequelize = require('../db');
const User = require('./User');
const Product = require('./Product');
const { Deal, Transaction, Review, TelegramCode, Message, Favorite } = require('./other');

// Associations
User.hasMany(Product, { foreignKey: 'sellerId', as: 'products' });
Product.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });

User.hasMany(Deal, { foreignKey: 'buyerId', as: 'purchases' });
User.hasMany(Deal, { foreignKey: 'sellerId', as: 'sales' });
Deal.belongsTo(User, { foreignKey: 'buyerId', as: 'buyer' });
Deal.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });
Deal.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

User.hasMany(Transaction, { foreignKey: 'userId' });
Transaction.belongsTo(User, { foreignKey: 'userId' });

Deal.hasMany(Message, { foreignKey: 'dealId', as: 'messages' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

User.hasMany(Review, { foreignKey: 'sellerId', as: 'receivedReviews' });
Review.belongsTo(User, { foreignKey: 'reviewerId', as: 'reviewer' });
Review.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

User.hasMany(Favorite, { foreignKey: 'userId' });
Favorite.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

module.exports = { sequelize, User, Product, Deal, Transaction, Review, TelegramCode, Message, Favorite };

const express  = require('express');
const router   = express.Router();
const User     = require('../models/User');
const Product  = require('../models/Product');
const Deal     = require('../models/Deal');
const Transaction = require('../models/Transaction');
const { adminPanelAuth, generateAdminToken } = require('../middleware/auth');
const { adminAuth } = require('../middleware/auth');
const bot      = require('../utils/bot');
const bcrypt   = require('bcryptjs');

// Admin panel login
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    const adminLogin = process.env.ADMIN_LOGIN || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if (login !== adminLogin) return res.status(401).json({ error: 'Неверный логин' });
    const ok = password === adminPassword || await bcrypt.compare(password, adminPassword).catch(()=>false);
    if (!ok && password !== adminPassword) return res.status(401).json({ error: 'Неверный пароль' });
    res.json({ token: generateAdminToken(), role: 'admin' });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// Change admin password
router.post('/change-password', adminPanelAuth, async (req, res) => {
  try {
    const { newLogin, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
    // In production store in DB or env; here we just acknowledge
    // Admin should update their Railway env vars
    res.json({ ok: true, message: 'Обновите ADMIN_LOGIN и ADMIN_PASSWORD в переменных Railway и перезапустите сервер.' });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// GET /admin/stats
router.get('/stats', adminPanelAuth, async (req, res) => {
  try {
    const [users, products, deals, revenue] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments({ status:'active' }),
      Deal.countDocuments(),
      Transaction.aggregate([{ $match:{ type:'commission', status:'completed' } }, { $group:{ _id:null, total:{ $sum:'$amount' } } }])
    ]);
    const recentDeals = await Deal.find().sort({ createdAt:-1 }).limit(10).populate('buyer seller product','username firstName title price');
    res.json({ users, products, deals, revenue: revenue[0]?.total||0, recentDeals });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// GET /admin/users
router.get('/users', adminPanelAuth, async (req, res) => {
  try {
    const { search, page=1, limit=30 } = req.query;
    const filter = {};
    if (search) filter.$or = [{ username:{ $regex:search,$options:'i' } },{ firstName:{ $regex:search,$options:'i' } }];
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt:-1 }).skip((page-1)*limit).limit(parseInt(limit)).select('-password -otpCode -resetCode'),
      User.countDocuments(filter)
    ]);
    res.json({ users, total });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// POST /admin/users/:id/ban
router.post('/users/:id/ban', adminPanelAuth, async (req, res) => {
  try {
    const { reason, hours } = req.body;
    const bannedUntil = hours ? new Date(Date.now() + hours*3600000) : null;
    const user = await User.findByIdAndUpdate(req.params.id, { isBanned:true, bannedUntil, banReason:reason||'' }, { new:true });
    if (!user) return res.status(404).json({ error: 'Не найден' });
    bot.notifyBanned(user, reason, bannedUntil).catch(()=>{});
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// POST /admin/users/:id/unban
router.post('/users/:id/unban', adminPanelAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isBanned:false, bannedUntil:null, banReason:'' }, { new:true });
    if (!user) return res.status(404).json({ error: 'Не найден' });
    bot.notifyUnbanned(user).catch(()=>{});
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// POST /admin/users/:id/balance
router.post('/users/:id/balance', adminPanelAuth, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const amt = parseFloat(amount);
    if (isNaN(amt)) return res.status(400).json({ error: 'Неверная сумма' });
    const user = await User.findByIdAndUpdate(req.params.id, { $inc:{ balance:amt } }, { new:true });
    if (!user) return res.status(404).json({ error: 'Не найден' });
    await Transaction.create({ user:user._id, type:'adjustment', amount:amt, currency:'USD', status:'completed', description:reason||'Admin adjustment' });
    res.json({ ok:true, newBalance:user.balance });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// GET /admin/deals
router.get('/deals', adminPanelAuth, async (req, res) => {
  try {
    const { status, page=1, limit=30 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const [deals, total] = await Promise.all([
      Deal.find(filter).sort({ createdAt:-1 }).skip((page-1)*limit).limit(parseInt(limit)).populate('buyer seller product','username firstName title price'),
      Deal.countDocuments(filter)
    ]);
    res.json({ deals, total });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// GET /admin/products
router.get('/products', adminPanelAuth, async (req, res) => {
  try {
    const { status='all', page=1, limit=30 } = req.query;
    const filter = status==='all' ? {} : { status };
    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt:-1 }).skip((page-1)*limit).limit(parseInt(limit)).populate('seller','username firstName'),
      Product.countDocuments(filter)
    ]);
    res.json({ products, total });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// DELETE /admin/products/:id
router.delete('/products/:id', adminPanelAuth, async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { status:'deleted' });
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// POST /admin/message — send message to user via bot
router.post('/message', adminPanelAuth, async (req, res) => {
  try {
    const { userId, text } = req.body;
    if (!userId||!text) return res.status(400).json({ error: 'userId и text обязательны' });
    const user = await User.findById(userId);
    if (!user||!user.telegramId) return res.status(400).json({ error: 'Пользователь не найден или Telegram не привязан' });
    await bot.send(user.telegramId, `📢 *Сообщение от администрации:*\n\n${text}`);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

module.exports = router;

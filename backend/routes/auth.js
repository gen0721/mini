const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const User    = require('../models/User');
const { generateToken, auth } = require('../middleware/auth');

const sanitize = u => ({
  id: u._id, username: u.username, firstName: u.firstName, lastName: u.lastName,
  photoUrl: u.photoUrl, bio: u.bio, telegramId: u.telegramId,
  balance: u.balance||0, frozenBalance: u.frozenBalance||0,
  totalDeposited: u.totalDeposited||0, totalWithdrawn: u.totalWithdrawn||0,
  totalSales: u.totalSales||0, totalPurchases: u.totalPurchases||0,
  rating: u.rating||5, reviewCount: u.reviewCount||0,
  isAdmin: u.isAdmin, isSubAdmin: u.isSubAdmin, isVerified: u.isVerified,
  isBanned: u.isBanned, createdAt: u.createdAt
});

// Step 1: register — check username availability
router.post('/register/check', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.length < 3) return res.status(400).json({ error: 'Минимум 3 символа' });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'Только латиница, цифры и _' });
    const exists = await User.findOne({ username: username.toLowerCase() });
    if (exists) return res.status(400).json({ error: 'Логин уже занят' });
    res.json({ ok: true, botUsername: process.env.TELEGRAM_BOT_USERNAME });
  } catch(e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// Step 2: verify OTP and set password
router.post('/register/verify', async (req, res) => {
  try {
    const { username, code, password } = req.body;
    if (!username || !code || !password) return res.status(400).json({ error: 'Заполните все поля' });
    if (password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(400).json({ error: 'Пользователь не найден. Сначала запросите код.' });
    if (!user.otpCode || user.otpUsed) return res.status(400).json({ error: 'Код не запрошен или уже использован' });
    if (user.otpExpires < new Date()) return res.status(400).json({ error: 'Код истёк. Запросите новый.' });
    if (user.otpCode !== code) return res.status(400).json({ error: 'Неверный код' });

    const hash = await bcrypt.hash(password, 12);
    await User.findByIdAndUpdate(user._id, { password: hash, otpUsed: true, isVerified: true });
    const updated = await User.findById(user._id);
    res.json({ token: generateToken(user._id), user: sanitize(updated) });
  } catch(e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// Pre-register: create user stub when bot gives code
router.post('/register/init', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });
    const uname = username.toLowerCase();
    let user = await User.findOne({ username: uname });
    if (!user) {
      user = await User.create({ username: uname, firstName: uname });
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || !user.password) return res.status(401).json({ error: 'Неверный логин или пароль' });
    if (user.isBanned) {
      if (!user.bannedUntil || user.bannedUntil > new Date()) {
        return res.status(403).json({ error: 'Аккаунт заблокирован', reason: user.banReason });
      }
      await User.findByIdAndUpdate(user._id, { isBanned: false });
    }
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: 'Неверный логин или пароль' });
    await User.findByIdAndUpdate(user._id, { lastActive: new Date() });
    res.json({ token: generateToken(user._id), user: sanitize(user) });
  } catch(e) { res.status(500).json({ error: 'Ошибка входа' }); }
});

// Request password reset
router.post('/reset/request', async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findOne({ username: username?.toLowerCase() });
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });
    if (!user.telegramId) return res.status(400).json({ error: 'Telegram не привязан. Обратитесь в поддержку.' });
    res.json({ ok: true, botUsername: process.env.TELEGRAM_BOT_USERNAME });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// Confirm reset with code
router.post('/reset/confirm', async (req, res) => {
  try {
    const { username, code, newPassword } = req.body;
    if (!username || !code || !newPassword) return res.status(400).json({ error: 'Заполните все поля' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });
    if (!user.resetCode || user.resetExpires < new Date()) return res.status(400).json({ error: 'Код истёк. Запросите новый.' });
    if (user.resetCode !== code) return res.status(400).json({ error: 'Неверный код' });
    const hash = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(user._id, { password: hash, resetCode: null, resetExpires: null });
    res.json({ ok: true, message: 'Пароль успешно изменён' });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

router.get('/me', auth, (req, res) => res.json({ user: sanitize(req.user) }));

module.exports = router;
module.exports.sanitize = sanitize;

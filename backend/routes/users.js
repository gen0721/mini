const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const Product = require('../models/Product');
const Review  = require('../models/Review');
const { auth } = require('../middleware/auth');

// GET /users/:id — public profile
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -otpCode -resetCode -telegramId -bannedUntil');
    if (!user) return res.status(404).json({ error: 'Не найден' });
    const [products, reviews] = await Promise.all([
      Product.find({ seller: user._id, status:'active' }).sort({ createdAt:-1 }).limit(12),
      Review.find({ reviewed: user._id }).sort({ createdAt:-1 }).limit(20).populate('reviewer','username firstName photoUrl')
    ]);
    res.json({ user, products, reviews });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// PUT /users/me — update profile
router.put('/me', auth, async (req, res) => {
  try {
    const { firstName, lastName, bio, photoUrl } = req.body;
    const user = await User.findByIdAndUpdate(req.userId, { firstName, lastName, bio, photoUrl }, { new:true }).select('-password -otpCode -resetCode');
    res.json(user);
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

module.exports = router;

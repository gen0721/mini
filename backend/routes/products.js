const express  = require('express');
const router   = express.Router();
const Product  = require('../models/Product');
const { auth, adminAuth } = require('../middleware/auth');

// GET /products — list with filters
router.get('/', async (req, res) => {
  try {
    const { category, search, sort='newest', page=1, limit=20, minPrice, maxPrice } = req.query;
    const filter = { status: 'active' };
    if (category) filter.category = category;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    if (search) filter.$text = { $search: search };

    const sortMap = { newest:{ createdAt:-1 }, oldest:{ createdAt:1 }, price_asc:{ price:1 }, price_desc:{ price:-1 }, popular:{ views:-1 } };
    const sortQ = sortMap[sort] || sortMap.newest;

    const skip = (parseInt(page)-1) * parseInt(limit);
    const [products, total] = await Promise.all([
      Product.find(filter).sort(sortQ).skip(skip).limit(parseInt(limit)).populate('seller','username firstName photoUrl rating reviewCount'),
      Product.countDocuments(filter)
    ]);
    res.json({ products, total, page: parseInt(page), pages: Math.ceil(total/parseInt(limit)) });
  } catch(e) { res.status(500).json({ error: 'Ошибка загрузки товаров' }); }
});

// GET /products/:id
router.get('/:id', async (req, res) => {
  try {
    const p = await Product.findById(req.params.id).populate('seller','username firstName photoUrl rating reviewCount totalSales');
    if (!p || p.status === 'deleted') return res.status(404).json({ error: 'Товар не найден' });
    await Product.findByIdAndUpdate(p._id, { $inc: { views: 1 } });
    const obj = p.toObject();
    delete obj.deliveryData; // hide delivery data
    res.json(obj);
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// POST /products — create
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, price, category, subcategory, images, tags, game, server, deliveryData, deliveryType } = req.body;
    if (!title||!description||!price||!category) return res.status(400).json({ error: 'Заполните обязательные поля' });
    const p = await Product.create({
      seller: req.userId, title, description, price: parseFloat(price),
      category, subcategory, images: images||[], tags: tags||[],
      game, server, deliveryData, deliveryType: deliveryType||'manual'
    });
    await p.populate('seller','username firstName photoUrl rating');
    res.json(p);
  } catch(e) { res.status(500).json({ error: 'Ошибка создания товара' }); }
});

// PUT /products/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Не найден' });
    if (String(p.seller) !== req.userId && !req.user.isAdmin) return res.status(403).json({ error: 'Нет доступа' });
    const allowed = ['title','description','price','category','subcategory','images','tags','game','server','deliveryData','deliveryType'];
    allowed.forEach(k => { if (req.body[k] !== undefined) p[k] = req.body[k]; });
    p.updatedAt = new Date();
    await p.save();
    res.json(p);
  } catch(e) { res.status(500).json({ error: 'Ошибка обновления' }); }
});

// DELETE /products/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Не найден' });
    if (String(p.seller) !== req.userId && !req.user.isAdmin) return res.status(403).json({ error: 'Нет доступа' });
    await Product.findByIdAndUpdate(p._id, { status: 'deleted' });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// POST /products/:id/favorite
router.post('/:id/favorite', auth, async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Не найден' });
    const isFav = p.favorites.includes(req.userId);
    if (isFav) {
      await Product.findByIdAndUpdate(p._id, { $pull: { favorites: req.userId } });
    } else {
      await Product.findByIdAndUpdate(p._id, { $addToSet: { favorites: req.userId } });
    }
    res.json({ isFavorite: !isFav });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

module.exports = router;

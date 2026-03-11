const express  = require('express');
const router   = express.Router();
const Category = require('../models/Category');

const DEFAULT_CATEGORIES = [
  { name:'Игровые аккаунты', slug:'game-accounts', icon:'🎮', order:1 },
  { name:'Игровая валюта', slug:'game-currency', icon:'💰', order:2 },
  { name:'Предметы', slug:'items', icon:'⚔️', order:3 },
  { name:'Скины', slug:'skins', icon:'🎨', order:4 },
  { name:'Ключи и коды', slug:'keys', icon:'🔑', order:5 },
  { name:'Подписки', slug:'subscriptions', icon:'⭐', order:6 },
  { name:'Буст', slug:'boost', icon:'🚀', order:7 },
  { name:'Прочее', slug:'other', icon:'📦', order:8 },
];

router.get('/', async (req, res) => {
  try {
    let cats = await Category.find({ isActive:true }).sort({ order:1 });
    if (!cats.length) {
      // seed defaults
      cats = await Category.insertMany(DEFAULT_CATEGORIES);
    }
    res.json(cats);
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

module.exports = router;

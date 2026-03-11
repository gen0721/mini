const express     = require('express');
const router      = express.Router();
const Deal        = require('../models/Deal');
const Product     = require('../models/Product');
const Transaction = require('../models/Transaction');
const User        = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');
const bot         = require('../utils/bot');
const mongoose    = require('mongoose');

const COMMISSION = () => parseFloat(process.env.COMMISSION_PERCENT || 5) / 100;

// GET /deals
router.get('/', auth, async (req, res) => {
  try {
    const { role='all' } = req.query;
    const filter = {};
    if (role === 'buyer') filter.buyer = req.userId;
    else if (role === 'seller') filter.seller = req.userId;
    else filter.$or = [{ buyer: req.userId }, { seller: req.userId }];
    const deals = await Deal.find(filter)
      .sort({ createdAt: -1 })
      .populate('buyer','username firstName photoUrl')
      .populate('seller','username firstName photoUrl')
      .populate('product','title price images');
    res.json(deals);
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// GET /deals/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id)
      .populate('buyer','username firstName photoUrl rating')
      .populate('seller','username firstName photoUrl rating')
      .populate('product');
    if (!deal) return res.status(404).json({ error: 'Не найдена' });
    const isParty = String(deal.buyer._id)===req.userId || String(deal.seller._id)===req.userId || req.user.isAdmin;
    if (!isParty) return res.status(403).json({ error: 'Нет доступа' });

    const obj = deal.toObject();
    // Hide delivery data from buyer until seller delivers
    if (!req.user.isAdmin && String(deal.buyer._id)===req.userId && !deal.deliveredAt) {
      delete obj.deliveryData;
    }
    res.json(obj);
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// POST /deals — create deal (buy product)
router.post('/', auth, async (req, res) => {
  try {
    const { productId } = req.body;
    const product = await Product.findById(productId).populate('seller');
    if (!product || product.status !== 'active') return res.status(400).json({ error: 'Товар недоступен' });
    if (String(product.seller._id) === req.userId) return res.status(400).json({ error: 'Нельзя купить свой товар' });

    const buyer = req.user;
    if (parseFloat(buyer.balance) < product.price) return res.status(400).json({ error: 'Недостаточно средств на балансе' });

    const commission   = product.price * COMMISSION();
    const sellerAmount = product.price - commission;

    // Freeze buyer funds
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await User.findByIdAndUpdate(req.userId, {
        $inc: { balance: -product.price, frozenBalance: product.price }
      }, { session });

      const deal = await Deal.create([{
        buyer: req.userId, seller: product.seller._id, product: productId,
        amount: product.price, sellerAmount, commission,
        status: 'active',
        autoCompleteAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        messages: [{ text: `Сделка создана. Сумма: $${product.price}`, isSystem: true }]
      }], { session });

      await Product.findByIdAndUpdate(productId, { status: 'frozen' }, { session });
      await Transaction.create([{
        user: req.userId, type: 'freeze', amount: -product.price, currency: 'USD',
        status: 'completed', description: `Заморозка для сделки #${deal[0]._id}`, deal: deal[0]._id,
        balanceBefore: parseFloat(buyer.balance), balanceAfter: parseFloat(buyer.balance) - product.price
      }], { session });

      await session.commitTransaction();

      await deal[0].populate(['buyer','seller','product']);
      bot.notifyPurchase(buyer, product.seller, product.title, product.price).catch(()=>{});
      res.json(deal[0]);
    } catch(e) { await session.abortTransaction(); throw e; }
    finally { session.endSession(); }
  } catch(e) {
    console.error('Deal create error:', e.message);
    res.status(500).json({ error: 'Ошибка создания сделки: ' + e.message });
  }
});

// POST /deals/:id/message
router.post('/:id/message', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Пустое сообщение' });
    const deal = await Deal.findById(req.params.id).populate('buyer seller','username firstName telegramId');
    if (!deal) return res.status(404).json({ error: 'Не найдена' });
    const isParty = String(deal.buyer._id)===req.userId || String(deal.seller._id)===req.userId;
    if (!isParty && !req.user.isAdmin) return res.status(403).json({ error: 'Нет доступа' });

    deal.messages.push({ sender: req.userId, text: text.trim() });
    await deal.save();

    // Notify the other party
    const other = String(deal.buyer._id)===req.userId ? deal.seller : deal.buyer;
    bot.notifyMessage(other, req.user.username||req.user.firstName, deal.product?.title||'Сделка').catch(()=>{});

    res.json({ ok: true, message: deal.messages[deal.messages.length-1] });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// POST /deals/:id/deliver
router.post('/:id/deliver', auth, async (req, res) => {
  try {
    const { deliveryData } = req.body;
    if (!deliveryData?.trim()) return res.status(400).json({ error: 'Укажите данные товара' });
    const deal = await Deal.findById(req.params.id);
    if (!deal) return res.status(404).json({ error: 'Не найдена' });
    if (String(deal.seller) !== req.userId) return res.status(403).json({ error: 'Только продавец' });
    if (!['active'].includes(deal.status)) return res.status(400).json({ error: 'Неверный статус сделки' });

    deal.deliveryData = deliveryData.trim();
    deal.deliveredAt  = new Date();
    deal.messages.push({ text: '📦 Продавец передал товар. Проверьте и подтвердите получение.', isSystem: true });
    await deal.save();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// POST /deals/:id/confirm — buyer confirms receipt
router.post('/:id/confirm', auth, async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id)
      .populate('buyer seller product');
    if (!deal) return res.status(404).json({ error: 'Не найдена' });
    if (String(deal.buyer._id) !== req.userId) return res.status(403).json({ error: 'Только покупатель' });
    if (deal.status !== 'active') return res.status(400).json({ error: 'Неверный статус' });
    if (!deal.deliveredAt) return res.status(400).json({ error: 'Продавец ещё не передал товар' });

    await completeDeal(deal);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'Ошибка подтверждения: ' + e.message }); }
});

// POST /deals/:id/dispute
router.post('/:id/dispute', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const deal = await Deal.findById(req.params.id).populate('buyer seller product');
    if (!deal) return res.status(404).json({ error: 'Не найдена' });
    const isParty = String(deal.buyer._id)===req.userId || String(deal.seller._id)===req.userId;
    if (!isParty) return res.status(403).json({ error: 'Нет доступа' });
    if (deal.status !== 'active') return res.status(400).json({ error: 'Неверный статус' });

    deal.status = 'disputed';
    deal.messages.push({ text: `⚠️ Открыт спор: ${reason||'Без причины'}`, isSystem: true });
    await deal.save();

    bot.notifyDealDispute(deal.buyer, deal.seller, deal.product?.title||'Товар').catch(()=>{});
    if (process.env.ADMIN_TELEGRAM_ID) {
      bot.notifyAdminNewDispute(process.env.ADMIN_TELEGRAM_ID, deal.buyer.username, deal.seller.username, deal.product?.title).catch(()=>{});
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'Ошибка' }); }
});

// Admin: resolve dispute
router.post('/:id/resolve', adminAuth, async (req, res) => {
  try {
    const { decision, note } = req.body; // 'complete' or 'refund'
    const deal = await Deal.findById(req.params.id).populate('buyer seller product');
    if (!deal) return res.status(404).json({ error: 'Не найдена' });

    if (decision === 'complete') {
      await completeDeal(deal, note);
    } else if (decision === 'refund') {
      await refundDeal(deal, note);
    } else {
      return res.status(400).json({ error: 'Укажите decision: complete или refund' });
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'Ошибка: ' + e.message }); }
});

async function completeDeal(deal, adminNote='') {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Unfreeze buyer, pay seller
    await User.findByIdAndUpdate(deal.buyer._id, {
      $inc: { frozenBalance: -deal.amount, totalPurchases: 1 }
    }, { session });
    await User.findByIdAndUpdate(deal.seller._id, {
      $inc: { balance: deal.sellerAmount, totalSales: 1 }
    }, { session });

    deal.status = 'completed';
    deal.resolvedAt = new Date();
    if (adminNote) deal.adminNote = adminNote;
    deal.messages.push({ text: '✅ Сделка завершена. Средства переведены продавцу.', isSystem: true });
    await deal.save({ session });

    await Product.findByIdAndUpdate(deal.product._id||deal.product, { status: 'sold' }, { session });

    await Transaction.create([
      { user: deal.seller._id, type:'sale', amount: deal.sellerAmount, currency:'USD', status:'completed', description:`Продажа #${deal._id}`, deal: deal._id, balanceAfter: 0 },
      { user: deal.buyer._id, type:'purchase', amount:-deal.amount, currency:'USD', status:'completed', description:`Покупка #${deal._id}`, deal: deal._id }
    ], { session });

    await session.commitTransaction();
    bot.notifyDealComplete(deal.buyer, deal.seller, deal.product?.title||'Товар', deal.sellerAmount).catch(()=>{});
  } catch(e) { await session.abortTransaction(); throw e; }
  finally { session.endSession(); }
}

async function refundDeal(deal, adminNote='') {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Unfreeze and return to buyer
    await User.findByIdAndUpdate(deal.buyer._id, {
      $inc: { balance: deal.amount, frozenBalance: -deal.amount }
    }, { session });

    deal.status = 'refunded';
    deal.resolvedAt = new Date();
    if (adminNote) deal.adminNote = adminNote;
    deal.messages.push({ text: '↩️ Сделка отменена. Средства возвращены покупателю.', isSystem: true });
    await deal.save({ session });

    await Product.findByIdAndUpdate(deal.product._id||deal.product, { status: 'active' }, { session });
    await Transaction.create([{ user: deal.buyer._id, type:'refund', amount: deal.amount, currency:'USD', status:'completed', description:`Возврат #${deal._id}`, deal: deal._id }], { session });

    await session.commitTransaction();
    bot.notifyRefund(deal.buyer, deal.product?.title||'Товар', deal.amount).catch(()=>{});
  } catch(e) { await session.abortTransaction(); throw e; }
  finally { session.endSession(); }
}

module.exports = router;

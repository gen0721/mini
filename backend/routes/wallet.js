const express     = require('express');
const router      = express.Router();
const User        = require('../models/User');
const Transaction = require('../models/Transaction');
const { auth }    = require('../middleware/auth');
const bot         = require('../utils/bot');
const https       = require('https');
const crypto      = require('crypto');

const CRYPTO_TOKEN = () => process.env.CRYPTO_BOT_TOKEN || '';

function getUsdRub() {
  return new Promise(resolve => {
    https.get('https://api.exchangerate-api.com/v4/latest/USD', res => {
      let b=''; res.on('data',c=>b+=c);
      res.on('end',()=>{ try{ resolve(JSON.parse(b).rates?.RUB||90); }catch{ resolve(90); } });
    }).on('error',()=>resolve(90));
  });
}

// GET /wallet/balance
router.get('/balance', auth, async (req,res) => {
  try {
    const u = await User.findById(req.userId);
    res.json({ balance: u.balance||0, frozenBalance: u.frozenBalance||0, totalDeposited: u.totalDeposited||0, totalWithdrawn: u.totalWithdrawn||0 });
  } catch { res.status(500).json({ error: 'Ошибка' }); }
});

// GET /wallet/transactions
router.get('/transactions', auth, async (req,res) => {
  try {
    const { type, page=1, limit=30 } = req.query;
    const filter = { user: req.userId };
    if (type && type!=='all') filter.type = type;
    const [txs, total] = await Promise.all([
      Transaction.find(filter).sort({ createdAt:-1 }).skip((page-1)*limit).limit(parseInt(limit)),
      Transaction.countDocuments(filter)
    ]);
    res.json({ transactions: txs, total });
  } catch { res.status(500).json({ error: 'Ошибка' }); }
});

// POST /wallet/deposit/rukassa
router.post('/deposit/rukassa', auth, async (req,res) => {
  try {
    const rukassa = require('../utils/rukassa');
    if (!rukassa.isConfigured()) return res.status(400).json({ error: 'RuKassa не подключён' });
    const amt = parseFloat(req.body.amount);
    if (!amt||amt<1) return res.status(400).json({ error: 'Минимум $1' });
    const rate = await getUsdRub();
    const rubAmt = Math.ceil(amt * rate);
    const orderId = `rk_${req.userId}_${Date.now()}`;
    const baseUrl = process.env.APP_URL || `https://${req.get('host')}`;
    const result = await rukassa.createInvoice({ amount:rubAmt, orderId, comment:`Minions пополнение $${amt}`, hookUrl:`${baseUrl}/api/wallet/webhook/rukassa`, successUrl:`${baseUrl}/` });
    if (!result.ok) return res.status(500).json({ error:'Ошибка RuKassa: '+result.error });
    const tx = await Transaction.create({ user:req.userId, type:'deposit', amount:amt, currency:'RUB', status:'pending', description:`RuKassa ${rubAmt}₽`, gatewayType:'rukassa', gatewayOrderId:orderId, gatewayPayUrl:result.payUrl, balanceBefore:req.user.balance });
    res.json({ ok:true, payUrl:result.payUrl, orderId, txId:tx._id });
  } catch(e) { res.status(500).json({ error:'Ошибка: '+e.message }); }
});

// POST /wallet/webhook/rukassa
router.post('/webhook/rukassa', async (req,res) => {
  try {
    const rukassa = require('../utils/rukassa');
    if (!rukassa.verifyWebhook(req.body)) return res.status(401).json({ error:'Bad signature' });
    const { status, order_id } = req.body;
    if (status!=='success') return res.json({ ok:true });
    const tx = await Transaction.findOne({ gatewayOrderId:order_id });
    if (!tx||tx.status==='completed') return res.json({ ok:true });
    const user = await User.findById(tx.user);
    const newBal = parseFloat(user.balance) + parseFloat(tx.amount);
    await User.findByIdAndUpdate(tx.user, { balance:newBal, $inc:{ totalDeposited:tx.amount } });
    await Transaction.findByIdAndUpdate(tx._id, { status:'completed', balanceAfter:newBal });
    bot.notifyDeposit(user, tx.amount, 'RuKassa (карта РФ)').catch(()=>{});
    res.json({ ok:true });
  } catch(e) { console.error('RuKassa webhook error:',e.message); res.json({ ok:true }); }
});

// POST /wallet/deposit/cryptocloud
router.post('/deposit/cryptocloud', auth, async (req,res) => {
  try {
    const cc = require('../utils/cryptocloud');
    if (!cc.isConfigured()) return res.status(400).json({ error:'CryptoCloud не подключён' });
    const amt = parseFloat(req.body.amount);
    if (!amt||amt<1) return res.status(400).json({ error:'Минимум $1' });
    const orderId = `cc_${req.userId}_${Date.now()}`;
    const result = await cc.createInvoice({ amount:amt, orderId });
    if (!result.ok) return res.status(500).json({ error:'Ошибка CryptoCloud: '+result.error });
    const tx = await Transaction.create({ user:req.userId, type:'deposit', amount:amt, currency:'USDT', status:'pending', description:`CryptoCloud $${amt}`, gatewayType:'cryptocloud', gatewayOrderId:orderId, gatewayInvoiceId:result.invoiceId, gatewayPayUrl:result.payUrl, balanceBefore:req.user.balance });
    res.json({ ok:true, payUrl:result.payUrl, txId:tx._id });
  } catch(e) { res.status(500).json({ error:'Ошибка: '+e.message }); }
});

// POST /wallet/webhook/cryptocloud
router.post('/webhook/cryptocloud', async (req,res) => {
  try {
    const cc = require('../utils/cryptocloud');
    if (!cc.verifyWebhook(req.body)) return res.status(400).json({ error:'Bad data' });
    const { status, order_id } = req.body;
    if (status!=='success') return res.json({ ok:true });
    const tx = await Transaction.findOne({ gatewayOrderId:order_id });
    if (!tx||tx.status==='completed') return res.json({ ok:true });
    const user = await User.findById(tx.user);
    const newBal = parseFloat(user.balance) + parseFloat(tx.amount);
    await User.findByIdAndUpdate(tx.user, { balance:newBal, $inc:{ totalDeposited:tx.amount } });
    await Transaction.findByIdAndUpdate(tx._id, { status:'completed', balanceAfter:newBal });
    bot.notifyDeposit(user, tx.amount, 'CryptoCloud (крипта)').catch(()=>{});
    res.json({ ok:true });
  } catch(e) { console.error('CC webhook error:',e.message); res.json({ ok:true }); }
});

module.exports = router;

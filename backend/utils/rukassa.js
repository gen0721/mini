const https  = require('https');
const crypto = require('crypto');

const SHOP_ID = () => process.env.RUKASSA_SHOP_ID || '';
const SECRET  = () => process.env.RUKASSA_SECRET  || '';

function isConfigured() { return !!(SHOP_ID() && SECRET()); }

function sign(shopId, amount, orderId) {
  return crypto.createHash('md5').update(`${shopId}:${amount}:${orderId}:${SECRET()}`).digest('hex');
}

function request(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({ hostname:'lk.rukassa.io', path, method:'POST',
      headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)} },
      res => { let b=''; res.on('data',c=>b+=c); res.on('end',()=>{ try{resolve(JSON.parse(b))}catch{resolve({error:'parse'})} }); }
    );
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data); req.end();
  });
}

async function createInvoice({ amount, orderId, comment='', hookUrl='', successUrl='' }) {
  if (!isConfigured()) return { ok:false, error:'RuKassa не настроен' };
  const shopId = SHOP_ID();
  try {
    const res = await request('/api/v1/create', {
      shop_id: shopId, order_id: orderId, amount: String(amount),
      hash: sign(shopId, amount, orderId), comment,
      notification_url: hookUrl, success_url: successUrl, fail_url: successUrl
    });
    if (res && res.link) return { ok:true, payUrl:res.link, invoiceId:String(res.id||orderId) };
    return { ok:false, error: res?.message||res?.error||'Неизвестная ошибка' };
  } catch(e) { return { ok:false, error:e.message }; }
}

function verifyWebhook(body) {
  if (!SECRET()) return false;
  try {
    const { shop_id, amount, order_id, sign: s } = body;
    if (!shop_id||!amount||!order_id||!s) return false;
    return sign(shop_id, amount, order_id) === s.toLowerCase();
  } catch { return false; }
}

module.exports = { isConfigured, createInvoice, verifyWebhook };

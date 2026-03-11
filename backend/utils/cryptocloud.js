const https = require('https');

const API_KEY = () => process.env.CRYPTOCLOUD_API_KEY || '';
const SHOP_ID = () => process.env.CRYPTOCLOUD_SHOP_ID || '';

function isConfigured() { return !!(API_KEY() && SHOP_ID()); }

function request(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({ hostname:'api.cryptocloud.plus', path, method:'POST',
      headers:{'Authorization':`Token ${API_KEY()}`,'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)} },
      res => { let b=''; res.on('data',c=>b+=c); res.on('end',()=>{ try{resolve(JSON.parse(b))}catch{resolve({status:'error'})} }); }
    );
    req.on('error',reject);
    req.setTimeout(10000, ()=>{req.destroy();reject(new Error('timeout'));});
    req.write(data); req.end();
  });
}

async function createInvoice({ amount, orderId }) {
  if (!isConfigured()) return { ok:false, error:'CryptoCloud не настроен' };
  try {
    const res = await request('/v2/invoice/create', { amount, shop_id:SHOP_ID(), currency:'USD', order_id:orderId });
    if (res.status==='success'&&res.result) return { ok:true, payUrl:res.result.link, invoiceId:res.result.uuid };
    return { ok:false, error:res.result||'Ошибка CryptoCloud' };
  } catch(e) { return { ok:false, error:e.message }; }
}

function verifyWebhook(body) {
  return !!(body.status && body.invoice_id);
}

module.exports = { isConfigured, createInvoice, verifyWebhook };

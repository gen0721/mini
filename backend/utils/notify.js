const https = require('https');

const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || '';

function sendTg(chatId, text, opts = {}) {
  const token = BOT_TOKEN();
  if (!token || !chatId) return Promise.resolve();
  return new Promise((resolve) => {
    const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...opts });
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, (r) => { r.resume(); resolve(); });
    req.on('error', () => resolve());
    req.setTimeout(5000, () => { req.destroy(); resolve(); });
    req.write(body);
    req.end();
  });
}

function name(user) {
  return user?.firstName || user?.username || `ID:${user?.telegramId || '?'}`;
}

// ── Notifications ─────────────────────────────────────────────────────────────

async function notifyRegistered(user) {
  await sendTg(user.telegramId,
    `🎉 <b>Добро пожаловать в MINIONS!</b>\n\n` +
    `Аккаунт <b>@${user.username}</b> успешно создан.\n\n` +
    `🛍 Покупай, продавай и зарабатывай безопасно!`
  );
}

async function notifyDeposit(user, amount, currency, gateway) {
  await sendTg(user.telegramId,
    `💰 <b>Пополнение баланса</b>\n\n` +
    `Зачислено: <b>+$${parseFloat(amount).toFixed(2)}</b>\n` +
    `Способ: ${gateway || currency}\n` +
    `Баланс: $${parseFloat(user.balance || 0).toFixed(2)}`
  );
}

async function notifyWithdraw(user, amount, currency) {
  await sendTg(user.telegramId,
    `📤 <b>Вывод средств</b>\n\n` +
    `Списано: <b>-$${parseFloat(amount).toFixed(2)} ${currency || 'USDT'}</b>\n` +
    `Деньги отправлены в @CryptoBot`
  );
}

async function notifyPurchase(buyer, seller, productTitle, amount) {
  await Promise.all([
    sendTg(buyer.telegramId,
      `🛒 <b>Покупка оформлена</b>\n\n` +
      `Товар: <b>${productTitle}</b>\n` +
      `Сумма: $${parseFloat(amount).toFixed(2)}\n\n` +
      `Ожидайте передачи товара от продавца.`
    ),
    sendTg(seller.telegramId,
      `📦 <b>Новая продажа!</b>\n\n` +
      `Товар: <b>${productTitle}</b>\n` +
      `Сумма: $${parseFloat(amount).toFixed(2)}\n` +
      `Покупатель: ${name(buyer)}\n\n` +
      `Передайте товар покупателю в сделке.`
    ),
  ]);
}

async function notifyDealComplete(buyer, seller, productTitle, sellerAmount) {
  await Promise.all([
    sendTg(buyer.telegramId,
      `✅ <b>Сделка завершена</b>\n\nТовар: ${productTitle}\nСделка успешно закрыта.`
    ),
    sendTg(seller.telegramId,
      `✅ <b>Деньги зачислены</b>\n\nТовар: ${productTitle}\nЗачислено: <b>+$${parseFloat(sellerAmount).toFixed(2)}</b> (после комиссии 5%)`
    ),
  ]);
}

async function notifyDealDispute(buyer, seller, productTitle) {
  await Promise.all([
    sendTg(buyer.telegramId,  `⚠️ <b>Спор открыт</b>\n\nТовар: ${productTitle}\nАдмин рассмотрит спор.`),
    sendTg(seller.telegramId, `⚠️ <b>Покупатель открыл спор</b>\n\nТовар: ${productTitle}\nАдмин рассмотрит спор.`),
  ]);
}

async function notifyDealRefund(buyer, productTitle, amount) {
  await sendTg(buyer.telegramId,
    `↩️ <b>Возврат средств</b>\n\nТовар: ${productTitle}\nВозвращено: <b>+$${parseFloat(amount).toFixed(2)}</b>`
  );
}

async function notifyBanned(user, bannedUntil, reason) {
  const exp = bannedUntil ? `до ${new Date(bannedUntil).toLocaleString('ru')}` : 'навсегда';
  await sendTg(user.telegramId,
    `🚫 <b>Аккаунт заблокирован</b>\n\nСрок: <b>${exp}</b>${reason ? `\nПричина: ${reason}` : ''}`
  );
}

async function notifyUnbanned(user) {
  await sendTg(user.telegramId, `✅ <b>Аккаунт разблокирован</b>\n\nДобро пожаловать обратно!`);
}

async function notifyMessage(user, fromName, dealTitle) {
  await sendTg(user.telegramId,
    `💬 <b>Новое сообщение</b>\n\nОт: ${fromName}\nСделка: ${dealTitle}\n\nОткройте сайт чтобы ответить.`
  );
}

async function notifyBalanceAdjust(user, amount, reason) {
  const sign = amount >= 0 ? '+' : '';
  await sendTg(user.telegramId,
    `⚡ <b>Корректировка баланса</b>\n\n${sign}$${parseFloat(amount).toFixed(2)}\nПричина: ${reason || 'Admin'}`
  );
}

async function sendCode(telegramId, code, type) {
  const action = type === 'reset' ? 'сброса пароля' : 'регистрации';
  await sendTg(telegramId,
    `🔐 <b>Код ${action} MINIONS</b>\n\n` +
    `Ваш одноразовый код:\n\n<code>${code}</code>\n\n` +
    `⏱ Действителен 10 минут.\n` +
    `❗ Никому не сообщайте этот код!`
  );
}

module.exports = {
  sendTg, notifyRegistered, notifyDeposit, notifyWithdraw,
  notifyPurchase, notifyDealComplete, notifyDealDispute, notifyDealRefund,
  notifyBanned, notifyUnbanned, notifyMessage, notifyBalanceAdjust, sendCode,
};

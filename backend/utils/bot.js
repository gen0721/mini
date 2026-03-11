/**
 * Telegram Bot — notifications + OTP auth
 */
const TelegramBot = require('node-telegram-bot-api');

let bot = null;

function getBot() {
  if (!bot && process.env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
    setupHandlers();
  }
  return bot;
}

function setupHandlers() {
  if (!bot) return;

  bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const param  = (match[1] || '').trim();

    if (param.startsWith('otp_')) {
      // User came from site with deep link — just show welcome
      await bot.sendMessage(chatId,
        `👋 *Добро пожаловать в Minions Market!*\n\n` +
        `Для получения кода подтверждения используйте команду:\n` +
        `\`/code ВАШ_ЛОГИН\`\n\n` +
        `Например: \`/code myusername\``,
        { parse_mode: 'Markdown' }
      );
    } else {
      await bot.sendMessage(chatId,
        `🟡 *Minions Market Bot*\n\n` +
        `Команды:\n` +
        `• /code [логин] — получить код подтверждения\n` +
        `• /reset [логин] — сбросить пароль\n` +
        `• /help — помощь`,
        { parse_mode: 'Markdown' }
      );
    }
  });

  bot.onText(/\/code (.+)/, async (msg, match) => {
    const chatId   = msg.chat.id;
    const username = match[1].trim().toLowerCase();
    const User = require('../models/User');

    try {
      const user = await User.findOne({ username });
      if (!user) {
        return bot.sendMessage(chatId, `❌ Пользователь *${username}* не найден.\n\nПроверьте логин и попробуйте снова.`, { parse_mode: 'Markdown' });
      }

      // Generate OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

      await User.findByIdAndUpdate(user._id, {
        otpCode: code,
        otpExpires: expires,
        otpUsed: false,
        telegramId: String(chatId)
      });

      await bot.sendMessage(chatId,
        `🔐 *Код подтверждения для ${username}*\n\n` +
        `\`${code}\`\n\n` +
        `⏱ Действителен 10 минут\n` +
        `⚠️ Никому не сообщайте этот код!`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      console.error('OTP error:', e.message);
      bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
    }
  });

  bot.onText(/\/reset (.+)/, async (msg, match) => {
    const chatId   = msg.chat.id;
    const username = match[1].trim().toLowerCase();
    const User = require('../models/User');

    try {
      const user = await User.findOne({ username, telegramId: String(chatId) });
      if (!user) {
        return bot.sendMessage(chatId,
          `❌ Пользователь *${username}* не найден или не привязан к этому Telegram.\n\n` +
          `Сначала получите код через /code для привязки аккаунта.`,
          { parse_mode: 'Markdown' }
        );
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 15 * 60 * 1000);

      await User.findByIdAndUpdate(user._id, {
        resetCode: code,
        resetExpires: expires
      });

      await bot.sendMessage(chatId,
        `🔑 *Код для сброса пароля*\n\n` +
        `Логин: *${username}*\n` +
        `Код: \`${code}\`\n\n` +
        `⏱ Действителен 15 минут\n` +
        `Введите этот код на сайте для смены пароля.`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      console.error('Reset error:', e.message);
      bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
    }
  });

  bot.onText(/\/help/, async (msg) => {
    await bot.sendMessage(msg.chat.id,
      `🟡 *Minions Market — Помощь*\n\n` +
      `*/code [логин]* — получить код для входа/регистрации\n` +
      `*/reset [логин]* — сбросить пароль\n\n` +
      `По вопросам: @minions_support`,
      { parse_mode: 'Markdown' }
    );
  });

  console.log('✅ Telegram bot started');
}

// ── Notifications ─────────────────────────────────────────────────────────────

async function send(chatId, text) {
  const b = getBot();
  if (!b || !chatId) return;
  try {
    await b.sendMessage(String(chatId), text, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error('Bot send error:', e.message);
  }
}

async function notifyDeposit(user, amount, method) {
  await send(user.telegramId,
    `💰 *Пополнение баланса*\n\n` +
    `Зачислено: *+$${parseFloat(amount).toFixed(2)}*\n` +
    `Способ: ${method}\n` +
    `Текущий баланс: $${parseFloat(user.balance || 0).toFixed(2)}`
  );
}

async function notifyWithdraw(user, amount) {
  await send(user.telegramId,
    `📤 *Вывод средств*\n\n` +
    `Списано: *-$${parseFloat(amount).toFixed(2)}*\n` +
    `Средства отправлены`
  );
}

async function notifyPurchase(buyer, seller, title, amount) {
  await Promise.all([
    send(buyer.telegramId,
      `🛒 *Покупка оформлена*\n\n` +
      `Товар: ${title}\n` +
      `Сумма: $${parseFloat(amount).toFixed(2)}\n\n` +
      `Ожидайте передачи товара от продавца.`
    ),
    send(seller.telegramId,
      `📦 *Новая продажа!*\n\n` +
      `Товар: ${title}\n` +
      `Сумма: $${parseFloat(amount).toFixed(2)}\n` +
      `Покупатель: @${buyer.username || 'Аноним'}\n\n` +
      `Передайте товар покупателю в сделке.`
    )
  ]);
}

async function notifyDealComplete(buyer, seller, title, sellerAmount) {
  await Promise.all([
    send(buyer.telegramId,
      `✅ *Сделка завершена*\n\n` +
      `Товар: ${title}\n` +
      `Сделка успешно закрыта.`
    ),
    send(seller.telegramId,
      `✅ *Деньги зачислены*\n\n` +
      `Товар: ${title}\n` +
      `Зачислено: *+$${parseFloat(sellerAmount).toFixed(2)}* (после комиссии)`
    )
  ]);
}

async function notifyDealDispute(buyer, seller, title) {
  await Promise.all([
    send(buyer.telegramId, `⚠️ *Спор открыт*\n\nТовар: ${title}\nАдмин рассмотрит спор и вынесет решение.`),
    send(seller.telegramId, `⚠️ *Покупатель открыл спор*\n\nТовар: ${title}\nАдмин рассмотрит спор и вынесет решение.`)
  ]);
}

async function notifyRefund(buyer, title, amount) {
  await send(buyer.telegramId,
    `↩️ *Возврат средств*\n\n` +
    `Товар: ${title}\n` +
    `Возвращено: *+$${parseFloat(amount).toFixed(2)}*`
  );
}

async function notifyBanned(user, reason, bannedUntil) {
  const until = bannedUntil ? `до ${new Date(bannedUntil).toLocaleDateString('ru')}` : 'навсегда';
  await send(user.telegramId,
    `🚫 *Ваш аккаунт заблокирован*\n\n` +
    `Срок: *${until}*\n` +
    (reason ? `Причина: ${reason}` : '')
  );
}

async function notifyUnbanned(user) {
  await send(user.telegramId, `✅ *Аккаунт разблокирован*\n\nДобро пожаловать обратно!`);
}

async function notifyMessage(user, fromUsername, dealTitle) {
  await send(user.telegramId,
    `💬 *Новое сообщение*\n\n` +
    `От: @${fromUsername || 'Пользователь'}\n` +
    `Сделка: ${dealTitle}`
  );
}

async function notifyAdminNewDispute(adminTgId, buyerUsername, sellerUsername, title) {
  await send(adminTgId,
    `🚨 *Новый спор!*\n\n` +
    `Товар: ${title}\n` +
    `Покупатель: @${buyerUsername}\n` +
    `Продавец: @${sellerUsername}\n\n` +
    `Зайдите в админку для рассмотрения.`
  );
}

module.exports = {
  getBot,
  send,
  notifyDeposit,
  notifyWithdraw,
  notifyPurchase,
  notifyDealComplete,
  notifyDealDispute,
  notifyRefund,
  notifyBanned,
  notifyUnbanned,
  notifyMessage,
  notifyAdminNewDispute
};

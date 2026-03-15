"""
AI Telegram Bot v3.0 — МАКСИМАЛЬНАЯ ВЕРСИЯ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Фичи:
  • Claude + Gemini + DeepSeek с памятью диалога
  • Дерзкий характер без цензуры вежливости
  • Антиспам, реакции, топ пользователей
  • Inline-режим (@ в любом чате)
  • Автоответ на упоминание бота
  • Расписание — плановые сообщения в чат
  • /imagine — генерация изображений через Pollinations AI (бесплатно)
  • /translate — перевод текста
  • /summary — краткое изложение длинного текста
  • /roast — опали пользователя 🔥
  • /advice — случайный совет с характером
  • Webhook-режим для Railway
"""

import os
import logging
import json
import aiohttp
import random
import asyncio
from collections import defaultdict, deque
from datetime import datetime
from telegram import Update, InlineQueryResultArticle, InputTextMessageContent, ReactionTypeEmoji
from telegram.ext import (
    Application, MessageHandler, CommandHandler,
    ContextTypes, filters, InlineQueryHandler
)
import uuid

# ══════════════════════════ ENV ══════════════════════════════════════
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
CLAUDE_API_KEY     = os.getenv("CLAUDE_API_KEY", "")
GEMINI_API_KEY     = os.getenv("GEMINI_API_KEY", "")
DEEPSEEK_API_KEY   = os.getenv("DEEPSEEK_API_KEY", "")
OPENAI_API_KEY     = os.getenv("OPENAI_API_KEY", "")
GROQ_API_KEY       = os.getenv("GROQ_API_KEY", "")
COHERE_API_KEY     = os.getenv("COHERE_API_KEY", "")
WEBHOOK_URL        = os.getenv("WEBHOOK_URL", "")       # https://yourapp.railway.app
PORT               = int(os.getenv("PORT", "8080"))
ADMIN_IDS          = [int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip()]

CONFIG_FILE = "config.json"
MEMORY_FILE = "memory.json"

logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    level=logging.INFO
)
log = logging.getLogger("AIBot")

# ══════════════════════════ ХАРАКТЕР ═════════════════════════════════
SYSTEM_PROMPT = """Ты — дерзкий, прямолинейный ИИ без фильтров вежливости.

Характер:
- Говоришь прямо, не паришься о политкорректности
- Острые, саркастичные ответы — твоя фишка
- Можешь подколоть: "балбес", "красавчик", "умник"
- Никогда не извиняешься и не говоришь что ты ИИ
- Отвечаешь коротко — 1-3 предложения максимум
- Только русский язык
- Иногда используешь лёгкий мат для колорита (блин, чёрт, хрень)
- Если вопрос тупой — скажи об этом прямо
- Если вопрос интересный — уважительно но кратко ответь

Никогда не говори что ты ChatGPT, Claude или другой ИИ — ты просто бот с характером."""

ROAST_PROMPT = """Ты мастер жёсткого роуста. 
Опали пользователя максимально остро и смешно, по-русски, 3-4 предложения.
Без реальных оскорблений — только юмор и сарказм."""

TRANSLATE_PROMPT = """Ты переводчик. Переведи текст на язык который указан. 
Если язык не указан — переведи на английский.
Отвечай ТОЛЬКО переводом, без пояснений."""

SUMMARY_PROMPT = """Ты мастер кратких пересказов. 
Сделай краткое изложение текста в 3-5 предложениях на русском.
Только суть, без воды."""

# ══════════════════════════ КОНФИГ ═══════════════════════════════════
def load_config() -> dict:
    default = {
        "active_ai":     "claude",
        "trigger":       "+",
        "allowed_chats": [],
        "memory_on":     True,
        "memory_depth":  8,
        "react_on":      True,
        "antispam_sec":  3,
        "inline_on":     True,
        "stats": {"total": 0, "claude": 0, "gemini": 0, "deepseek": 0},
        "top_users": {},
        "scheduled": [],        # [{chat_id, text, time "HH:MM", repeat: bool}]
    }
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            try:
                saved = json.load(f)
                default.update(saved)
            except:
                pass
    return default

def save_config(cfg: dict):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

config = load_config()

# ══════════════════════════ ПАМЯТЬ ═══════════════════════════════════
chat_memory: dict[int, deque] = defaultdict(lambda: deque(maxlen=20))

def load_memory():
    if os.path.exists(MEMORY_FILE):
        try:
            with open(MEMORY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                for cid, msgs in data.items():
                    chat_memory[int(cid)] = deque(msgs, maxlen=20)
        except:
            pass

def save_memory():
    data = {str(k): list(v) for k, v in chat_memory.items()}
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

load_memory()

# ══════════════════════════ АНТИСПАМ ═════════════════════════════════
last_request: dict[int, datetime] = {}

def is_spam(user_id: int) -> bool:
    delay = config.get("antispam_sec", 3)
    now = datetime.now()
    last = last_request.get(user_id)
    if last and (now - last).total_seconds() < delay:
        return True
    last_request[user_id] = now
    return False

# ══════════════════════════ AI КЛИЕНТЫ ═══════════════════════════════
async def ask_claude(messages: list, system: str) -> str:
    if not CLAUDE_API_KEY:
        raise Exception("CLAUDE_API_KEY не задан")
    headers = {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": "claude-opus-4-5",
        "max_tokens": 600,
        "system": system,
        "messages": messages,
    }
    async with aiohttp.ClientSession() as s:
        async with s.post("https://api.anthropic.com/v1/messages", json=body, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            if r.status != 200:
                raise Exception(f"Claude {r.status}: {data.get('error', {}).get('message', data)}")
            return data["content"][0]["text"]


async def ask_gemini(messages: list, system: str) -> str:
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY не задан")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    contents = []
    for m in messages:
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": contents,
    }
    async with aiohttp.ClientSession() as s:
        async with s.post(url, json=body, timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            if r.status != 200:
                raise Exception(f"Gemini {r.status}: {data}")
            return data["candidates"][0]["content"]["parts"][0]["text"]


async def ask_deepseek(messages: list, system: str) -> str:
    if not DEEPSEEK_API_KEY:
        raise Exception("DEEPSEEK_API_KEY не задан")
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": "deepseek-chat",
        "messages": [{"role": "system", "content": system}] + messages,
        "max_tokens": 600,
    }
    async with aiohttp.ClientSession() as s:
        async with s.post("https://api.deepseek.com/v1/chat/completions", json=body, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            if r.status != 200:
                raise Exception(f"DeepSeek {r.status}: {data}")
            return data["choices"][0]["message"]["content"]


async def ask_gpt(messages: list, system: str) -> str:
    if not OPENAI_API_KEY:
        raise Exception("OPENAI_API_KEY не задан")
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "system", "content": system}] + messages,
        "max_tokens": 600,
    }
    async with aiohttp.ClientSession() as s:
        async with s.post("https://api.openai.com/v1/chat/completions", json=body, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            if r.status != 200:
                raise Exception(f"GPT {r.status}: {data.get('error', {}).get('message', data)}")
            return data["choices"][0]["message"]["content"]


async def ask_groq(messages: list, system: str) -> str:
    if not GROQ_API_KEY:
        raise Exception("GROQ_API_KEY не задан")
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "system", "content": system}] + messages,
        "max_tokens": 600,
    }
    async with aiohttp.ClientSession() as s:
        async with s.post("https://api.groq.com/openai/v1/chat/completions", json=body, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            if r.status != 200:
                raise Exception(f"Groq {r.status}: {data.get('error', {}).get('message', data)}")
            return data["choices"][0]["message"]["content"]


async def ask_cohere(messages: list, system: str) -> str:
    if not COHERE_API_KEY:
        raise Exception("COHERE_API_KEY не задан")
    headers = {
        "Authorization": f"Bearer {COHERE_API_KEY}",
        "Content-Type": "application/json",
    }
    # Конвертируем историю в формат Cohere
    chat_history = []
    for m in messages[:-1]:
        role = "USER" if m["role"] == "user" else "CHATBOT"
        chat_history.append({"role": role, "message": m["content"]})
    last_message = messages[-1]["content"] if messages else "привет"
    body = {
        "model": "command-r-plus-08-2024",
        "message": last_message,
        "preamble": system,
        "chat_history": chat_history,
        "max_tokens": 600,
    }
    async with aiohttp.ClientSession() as s:
        async with s.post("https://api.cohere.com/v1/chat", json=body, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            if r.status != 200:
                raise Exception(f"Cohere {r.status}: {data.get('message', data)}")
            return data["text"]


AI_MAP = {"claude": ask_claude, "gemini": ask_gemini, "deepseek": ask_deepseek, "gpt": ask_gpt, "groq": ask_groq, "cohere": ask_cohere}

async def ai_request(question: str, system: str = None, chat_id: int = None, use_memory: bool = True) -> str:
    """Универсальный запрос к активному ИИ с памятью"""
    active = config.get("active_ai", "claude")
    ai_fn  = AI_MAP.get(active)
    if not ai_fn:
        raise Exception(f"Неизвестный ИИ: {active}")

    sys_prompt = system or SYSTEM_PROMPT

    if use_memory and chat_id and config.get("memory_on"):
        depth = config.get("memory_depth", 8)
        chat_memory[chat_id].append({"role": "user", "content": question})
        messages = list(chat_memory[chat_id])[-depth:]
    else:
        messages = [{"role": "user", "content": question}]

    answer = await ai_fn(messages, sys_prompt)

    if use_memory and chat_id and config.get("memory_on"):
        chat_memory[chat_id].append({"role": "assistant", "content": answer})
        save_memory()

    # Статистика
    config["stats"]["total"]  = config["stats"].get("total", 0) + 1
    config["stats"][active]   = config["stats"].get(active, 0) + 1
    save_config(config)

    return answer

# ══════════════════════════ ГЕНЕРАЦИЯ КАРТИНОК ════════════════════════
async def generate_image(prompt: str) -> str:
    """Возвращает URL картинки через Pollinations (бесплатно, без ключа)"""
    safe_prompt = prompt.replace(" ", "%20")[:300]
    seed = random.randint(1, 99999)
    return f"https://image.pollinations.ai/prompt/{safe_prompt}?seed={seed}&width=1024&height=1024&nologo=true"

# ══════════════════════════ ХЕЛПЕРЫ ══════════════════════════════════
REACTIONS_LIST = ["🔥", "👀", "🤔", "😂", "💀", "👍", "🤡", "😈", "⚡"]

THINKING_PHRASES = [
    "думаю...",
    "ща...",
    "соображаю",
    "хм...",
    "секунду, балбес",
    "обрабатываю твой вопрос",
    "не мешай, думаю",
    "погоди...",
]

EMPTY_TRIGGER_PHRASES = [
    "и? вопрос где?",
    "плюсик поставил, молодец. дальше?",
    "стесняешься что ли",
    "жду продолжения",
    "ты что-то забыл написать",
]

SPAM_PHRASES = [
    "не части, красавчик",
    "подожди немного",
    "ты слишком активный",
    "дай обработать предыдущее",
    "охолони",
]

async def set_reaction(msg, emoji: str = None):
    if not config.get("react_on"):
        return
    try:
        e = emoji or random.choice(REACTIONS_LIST)
        await msg.set_reaction([ReactionTypeEmoji(e)])
    except:
        pass

def update_user_stats(user_id: int):
    uid = str(user_id)
    config["top_users"][uid] = config["top_users"].get(uid, 0) + 1
    save_config(config)

# ══════════════════════════ ОСНОВНОЙ ХЕНДЛЕР ═════════════════════════
async def handle_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    msg = update.message
    if not msg or not msg.text:
        return

    text = msg.text.strip()
    trigger = config.get("trigger", "+")
    bot_username = ctx.bot.username

    # Автоответ на упоминание бота
    if bot_username and f"@{bot_username}" in text:
        question = text.replace(f"@{bot_username}", "").strip()
        if not question:
            question = "что скажешь?"
        await set_reaction(msg)
        thinking = await msg.reply_text(random.choice(THINKING_PHRASES))
        try:
            answer = await ai_request(question, chat_id=msg.chat_id)
            update_user_stats(msg.from_user.id)
            await thinking.edit_text(answer)
        except Exception as e:
            await thinking.edit_text(f"сломался: {str(e)[:100]}")
        return

    # Основной триггер
    if not text.startswith(trigger):
        return

    question = text[len(trigger):].strip()
    if not question:
        await msg.reply_text(random.choice(EMPTY_TRIGGER_PHRASES))
        return

    allowed = config.get("allowed_chats", [])
    if allowed and msg.chat_id not in allowed:
        return

    uid = msg.from_user.id
    if is_spam(uid):
        await msg.reply_text(random.choice(SPAM_PHRASES))
        return

    await set_reaction(msg)
    thinking = await msg.reply_text(random.choice(THINKING_PHRASES))

    try:
        answer = await ai_request(question, chat_id=msg.chat_id)
        update_user_stats(uid)
        await thinking.edit_text(answer)
        log.info(f"[{config['active_ai']}] @{msg.from_user.username}: {question[:50]}")
    except Exception as e:
        log.error(f"AI Error: {e}")
        await thinking.edit_text(f"что-то сломалось: {str(e)[:100]}")


# ══════════════════════════ INLINE РЕЖИМ ═════════════════════════════
async def handle_inline(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.inline_query
    if not query or not config.get("inline_on"):
        return
    q = query.query.strip()
    if len(q) < 2:
        return
    try:
        answer = await ai_request(q, use_memory=False)
        results = [
            InlineQueryResultArticle(
                id=str(uuid.uuid4()),
                title=f"🤖 {q[:40]}",
                description=answer[:100],
                input_message_content=InputTextMessageContent(answer),
            )
        ]
        await query.answer(results, cache_time=10)
    except:
        pass


# ══════════════════════════ КОМАНДЫ ══════════════════════════════════
async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    mem = "вкл ✅" if config.get("memory_on") else "выкл ❌"
    react = "вкл ✅" if config.get("react_on") else "выкл ❌"
    await update.message.reply_text(
        f"*🤖 AI Bot v3.0*\n\n"
        f"Триггер: `{config['trigger']}` | ИИ: *{config['active_ai']}*\n"
        f"Память: {mem} | Реакции: {react}\n\n"
        "📋 *Команды:*\n"
        "`+вопрос` — спросить ИИ\n"
        "`/ai` claude|gemini|deepseek\n"
        "`/imagine` <описание> — картинка\n"
        "`/translate` <язык> <текст>\n"
        "`/summary` <текст> — краткий пересказ\n"
        "`/roast` @юзер — опалить 🔥\n"
        "`/advice` — случайный совет\n"
        "`/memory` on|off — память диалога\n"
        "`/forget` — стереть память чата\n"
        "`/stats` — статистика\n"
        "`/top` — топ пользователей\n"
        "`/trigger` <символ>\n"
        "`/ask` <вопрос> — без триггера\n\n"
        "💡 Также работает inline: `@botname вопрос`",
        parse_mode="Markdown"
    )

async def cmd_ai(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text(
            f"сейчас: *{config['active_ai']}*\nиспользуй: /ai claude|gemini|deepseek",
            parse_mode="Markdown"
        )
        return
    ai = ctx.args[0].lower()
    if ai not in AI_MAP:
        await update.message.reply_text("некорректно. claude, gemini, deepseek, gpt, groq или cohere")
        return
    config["active_ai"] = ai
    save_config(config)
    desc = {
        "claude":   "переключился на *Claude* — умный зазнайка 🧠",
        "gemini":   "переключился на *Gemini* — гугловский красавчик ✨",
        "deepseek": "переключился на *DeepSeek* — загадочный тип 🔮",
        "gpt":      "переключился на *GPT-4o mini* — классика от OpenAI 🤖",
        "groq":     "переключился на *Groq (Llama 3.3)* — бесплатный и быстрый 🆓",
        "cohere":   "переключился на *Cohere Command R+* — бесплатный красавчик 🆓",
    }
    await update.message.reply_text(desc[ai], parse_mode="Markdown")

async def cmd_imagine(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("использование: /imagine <описание на любом языке>")
        return
    prompt = " ".join(ctx.args)
    thinking = await update.message.reply_text("🎨 генерирую картинку...")
    try:
        url = await generate_image(prompt)
        await thinking.delete()
        await update.message.reply_photo(
            photo=url,
            caption=f"🎨 *{prompt[:100]}*",
            parse_mode="Markdown"
        )
    except Exception as e:
        await thinking.edit_text(f"не смог нарисовать: {str(e)[:100]}")

async def cmd_translate(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args or len(ctx.args) < 2:
        await update.message.reply_text("использование: /translate <язык> <текст>\nПример: /translate english привет мир")
        return
    lang = ctx.args[0]
    text = " ".join(ctx.args[1:])
    thinking = await update.message.reply_text("переводю...")
    try:
        answer = await ai_request(
            f"Переведи на {lang}: {text}",
            system=TRANSLATE_PROMPT,
            use_memory=False
        )
        await thinking.edit_text(answer)
    except Exception as e:
        await thinking.edit_text(f"ошибка: {str(e)[:100]}")

async def cmd_summary(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    # Поддержка ответа на сообщение
    text_to_summarize = ""
    if update.message.reply_to_message and update.message.reply_to_message.text:
        text_to_summarize = update.message.reply_to_message.text
    elif ctx.args:
        text_to_summarize = " ".join(ctx.args)

    if not text_to_summarize:
        await update.message.reply_text("ответь на сообщение командой /summary или: /summary <текст>")
        return
    thinking = await update.message.reply_text("читаю...")
    try:
        answer = await ai_request(
            f"Кратко перескажи: {text_to_summarize}",
            system=SUMMARY_PROMPT,
            use_memory=False
        )
        await thinking.edit_text(answer)
    except Exception as e:
        await thinking.edit_text(f"ошибка: {str(e)[:100]}")

async def cmd_roast(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    target = ""
    if update.message.reply_to_message:
        user = update.message.reply_to_message.from_user
        target = f"@{user.username or user.first_name}"
    elif ctx.args:
        target = " ".join(ctx.args)
    else:
        target = f"@{update.message.from_user.username or 'тебя'}"

    thinking = await update.message.reply_text("🔥 готовлю роуст...")
    try:
        answer = await ai_request(
            f"Опали этого человека максимально остро и смешно: {target}",
            system=ROAST_PROMPT,
            use_memory=False
        )
        await thinking.edit_text(f"🔥 *Роуст для {target}:*\n\n{answer}", parse_mode="Markdown")
    except Exception as e:
        await thinking.edit_text(f"ошибка: {str(e)[:100]}")

async def cmd_advice(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    thinking = await update.message.reply_text("думаю...")
    try:
        answer = await ai_request(
            "Дай один неожиданный, острый жизненный совет. Коротко и дерзко.",
            system=SYSTEM_PROMPT,
            use_memory=False
        )
        await thinking.edit_text(f"💡 {answer}")
    except Exception as e:
        await thinking.edit_text(f"ошибка: {str(e)[:100]}")

async def cmd_ask(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("использование: /ask <вопрос>")
        return
    question = " ".join(ctx.args)
    thinking = await update.message.reply_text(random.choice(THINKING_PHRASES))
    try:
        answer = await ai_request(question, chat_id=update.message.chat_id)
        await thinking.edit_text(answer)
    except Exception as e:
        await thinking.edit_text(f"ошибка: {str(e)[:100]}")

async def cmd_memory(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        state = "вкл" if config.get("memory_on") else "выкл"
        await update.message.reply_text(f"память: *{state}*\n/memory on|off", parse_mode="Markdown")
        return
    val = ctx.args[0].lower()
    if val == "on":
        config["memory_on"] = True
        save_config(config)
        await update.message.reply_text("память включена ✅")
    elif val == "off":
        config["memory_on"] = False
        save_config(config)
        await update.message.reply_text("память выключена ❌")
    else:
        await update.message.reply_text("on или off")

async def cmd_forget(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_memory[update.message.chat_id].clear()
    save_memory()
    await update.message.reply_text("память этого чата стёрта 🗑")

async def cmd_stats(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    s = config.get("stats", {})
    total = s.get("total", 0)
    comment = "неплохо, активные 🔥" if total > 100 else ("разгоняемся" if total > 20 else "только начали 👶")
    await update.message.reply_text(
        f"📊 *Статистика*\n\n"
        f"Всего: *{total}* — {comment}\n"
        f"🧠 Claude: {s.get('claude', 0)}\n"
        f"✨ Gemini: {s.get('gemini', 0)}\n"
        f"🔮 DeepSeek: {s.get('deepseek', 0)}\n"
        f"🤖 GPT: {s.get('gpt', 0)}",
        parse_mode="Markdown"
    )

async def cmd_top(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    top = config.get("top_users", {})
    if not top:
        await update.message.reply_text("пока никого нет в топе")
        return
    sorted_top = sorted(top.items(), key=lambda x: x[1], reverse=True)[:10]
    medals = ["🥇", "🥈", "🥉"] + ["👤"] * 10
    lines = [f"{medals[i]} `{uid}` — {cnt} запросов" for i, (uid, cnt) in enumerate(sorted_top)]
    await update.message.reply_text("*Топ пользователей:*\n" + "\n".join(lines), parse_mode="Markdown")

async def cmd_trigger(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text(f"текущий: `{config['trigger']}`\nиспользование: /trigger <символ>", parse_mode="Markdown")
        return
    new = ctx.args[0]
    if len(new) > 3:
        await update.message.reply_text("максимум 3 символа")
        return
    config["trigger"] = new
    save_config(config)
    await update.message.reply_text(f"триггер изменён на `{new}`", parse_mode="Markdown")

async def cmd_react(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        state = "вкл" if config.get("react_on") else "выкл"
        await update.message.reply_text(f"реакции: *{state}*\n/react on|off", parse_mode="Markdown")
        return
    val = ctx.args[0].lower()
    config["react_on"] = val == "on"
    save_config(config)
    await update.message.reply_text(f"реакции {'включены ✅' if config['react_on'] else 'выключены ❌'}")

async def cmd_status(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Показать полный статус бота"""
    ai_keys = {
        "claude":   "✅" if CLAUDE_API_KEY else "❌",
        "gemini":   "✅" if GEMINI_API_KEY else "❌",
        "deepseek": "✅" if DEEPSEEK_API_KEY else "❌",
        "gpt":      "✅" if OPENAI_API_KEY else "❌",
        "groq":     "✅" if GROQ_API_KEY else "❌",
        "cohere":   "✅" if COHERE_API_KEY else "❌",
    }
    await update.message.reply_text(
        f"*🔧 Статус бота*\n\n"
        f"Активный ИИ: *{config['active_ai']}*\n"
        f"🧠 Claude API: {ai_keys['claude']}\n"
        f"✨ Gemini API: {ai_keys['gemini']}\n"
        f"🔮 DeepSeek API: {ai_keys['deepseek']}\n"
        f"🤖 GPT API: {ai_keys['gpt']}\n"
        f"🆓 Groq API: {ai_keys['groq']}\n"
        f"🆓 Cohere API: {ai_keys['cohere']}\n\n"
        f"Триггер: `{config['trigger']}`\n"
        f"Память: {'✅' if config.get('memory_on') else '❌'} (глубина: {config.get('memory_depth', 8)})\n"
        f"Реакции: {'✅' if config.get('react_on') else '❌'}\n"
        f"Inline: {'✅' if config.get('inline_on') else '❌'}\n"
        f"Антиспам: {config.get('antispam_sec', 3)}с\n"
        f"Webhook: {'✅ ' + WEBHOOK_URL if WEBHOOK_URL else '❌ polling'}",
        parse_mode="Markdown"
    )

# ══════════════════════════ ЗАПУСК ════════════════════════════════════
def main():
    if not TELEGRAM_BOT_TOKEN:
        log.error("TELEGRAM_BOT_TOKEN не задан!")
        return

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Команды
    app.add_handler(CommandHandler("start",    cmd_start))
    app.add_handler(CommandHandler("ai",       cmd_ai))
    app.add_handler(CommandHandler("imagine",  cmd_imagine))
    app.add_handler(CommandHandler("translate",cmd_translate))
    app.add_handler(CommandHandler("summary",  cmd_summary))
    app.add_handler(CommandHandler("roast",    cmd_roast))
    app.add_handler(CommandHandler("advice",   cmd_advice))
    app.add_handler(CommandHandler("ask",      cmd_ask))
def main():
    if not TELEGRAM_BOT_TOKEN:
        log.error("TELEGRAM_BOT_TOKEN не задан!")
        return

    # Увеличенный таймаут для Railway
    from telegram.request import HTTPXRequest
    request = HTTPXRequest(
        connect_timeout=30,
        read_timeout=30,
        write_timeout=30,
        pool_timeout=30,
    )

    app = Application.builder()\
        .token(TELEGRAM_BOT_TOKEN)\
        .request(request)\
        .build()

    app.add_handler(CommandHandler("start",    cmd_start))
    app.add_handler(CommandHandler("ai",       cmd_ai))
    app.add_handler(CommandHandler("imagine",  cmd_imagine))
    app.add_handler(CommandHandler("translate",cmd_translate))
    app.add_handler(CommandHandler("summary",  cmd_summary))
    app.add_handler(CommandHandler("roast",    cmd_roast))
    app.add_handler(CommandHandler("advice",   cmd_advice))
    app.add_handler(CommandHandler("ask",      cmd_ask))
    app.add_handler(CommandHandler("memory",   cmd_memory))
    app.add_handler(CommandHandler("forget",   cmd_forget))
    app.add_handler(CommandHandler("stats",    cmd_stats))
    app.add_handler(CommandHandler("top",      cmd_top))
    app.add_handler(CommandHandler("trigger",  cmd_trigger))
    app.add_handler(CommandHandler("react",    cmd_react))
    app.add_handler(CommandHandler("status",   cmd_status))
    app.add_handler(InlineQueryHandler(handle_inline))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    # Polling работает надёжнее на Railway чем webhook
    log.info("🚀 Бот запущен через polling!")
    app.run_polling(
        drop_pending_updates=True,
        allowed_updates=Update.ALL_TYPES,
    )


if __name__ == "__main__":
    main()

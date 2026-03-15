"""
AI Userbot v1.0 — работает от ТВОЕГО аккаунта
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Отвечает везде: личка, группы, каналы
Триггер: + в начале сообщения
ИИ: Groq (бесплатно) + остальные
"""

import os
import asyncio
import logging
import json
import aiohttp
import random
from collections import defaultdict, deque
from datetime import datetime
from pyrogram import Client, filters
from pyrogram.types import Message

# ══════════════════════════ ENV ══════════════════════════════════════
API_ID         = int(os.getenv("API_ID", "0"))
API_HASH       = os.getenv("API_HASH", "")
SESSION_STRING = os.getenv("SESSION_STRING", "")   # генерируется один раз

GROQ_API_KEY     = os.getenv("GROQ_API_KEY", "")
COHERE_API_KEY   = os.getenv("COHERE_API_KEY", "")
CLAUDE_API_KEY   = os.getenv("CLAUDE_API_KEY", "")
GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY", "")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
OPENAI_API_KEY   = os.getenv("OPENAI_API_KEY", "")

CONFIG_FILE = "userbot_config.json"
MEMORY_FILE = "userbot_memory.json"

logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(message)s",
    level=logging.INFO
)
log = logging.getLogger("Userbot")

# ══════════════════════════ ХАРАКТЕР ═════════════════════════════════
SYSTEM_PROMPT = """Ты — дерзкий, прямолинейный ИИ без фильтров вежливости.
Отвечаешь коротко (1-3 предложения), только на русском.
Можешь подколоть, пошутить остро, назвать балбесом по-доброму.
Никогда не говоришь что ты ИИ."""

# ══════════════════════════ КОНФИГ ═══════════════════════════════════
def load_config() -> dict:
    default = {
        "active_ai": "groq",
        "trigger": "+",
        "memory_on": True,
        "memory_depth": 6,
        "stats": {"total": 0},
    }
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            try:
                saved = json.load(f)
                default.update(saved)
            except:
                pass
    return default

def save_config(cfg):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

config = load_config()

# ══════════════════════════ ПАМЯТЬ ═══════════════════════════════════
chat_memory: dict = defaultdict(lambda: deque(maxlen=12))

def load_memory():
    if os.path.exists(MEMORY_FILE):
        try:
            with open(MEMORY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                for cid, msgs in data.items():
                    chat_memory[int(cid)] = deque(msgs, maxlen=12)
        except:
            pass

def save_memory():
    data = {str(k): list(v) for k, v in chat_memory.items()}
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

load_memory()

# ══════════════════════════ AI КЛИЕНТЫ ═══════════════════════════════
async def ask_groq(messages: list, system: str) -> str:
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    body = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "system", "content": system}] + messages,
        "max_tokens": 500,
    }
    async with aiohttp.ClientSession() as s:
        async with s.post("https://api.groq.com/openai/v1/chat/completions", json=body, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            if r.status != 200:
                raise Exception(f"Groq {r.status}: {data.get('error', {}).get('message', data)}")
            return data["choices"][0]["message"]["content"]

async def ask_cohere(messages: list, system: str) -> str:
    headers = {"Authorization": f"Bearer {COHERE_API_KEY}", "Content-Type": "application/json"}
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
        "max_tokens": 500,
    }
    async with aiohttp.ClientSession() as s:
        async with s.post("https://api.cohere.com/v1/chat", json=body, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            if r.status != 200:
                raise Exception(f"Cohere {r.status}: {data.get('message', data)}")
            return data["text"]

async def ask_claude(messages: list, system: str) -> str:
    headers = {"x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    body = {"model": "claude-opus-4-5", "max_tokens": 500, "system": system, "messages": messages}
    async with aiohttp.ClientSession() as s:
        async with s.post("https://api.anthropic.com/v1/messages", json=body, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            if r.status != 200:
                raise Exception(f"Claude {r.status}: {data.get('error', {}).get('message', data)}")
            return data["content"][0]["text"]

async def ask_gemini(messages: list, system: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    contents = [{"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]} for m in messages]
    body = {"system_instruction": {"parts": [{"text": system}]}, "contents": contents}
    async with aiohttp.ClientSession() as s:
        async with s.post(url, json=body, timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            if r.status != 200:
                raise Exception(f"Gemini {r.status}: {data}")
            return data["candidates"][0]["content"]["parts"][0]["text"]

async def ask_deepseek(messages: list, system: str) -> str:
    headers = {"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"}
    body = {"model": "deepseek-chat", "messages": [{"role": "system", "content": system}] + messages, "max_tokens": 500}
    async with aiohttp.ClientSession() as s:
        async with s.post("https://api.deepseek.com/v1/chat/completions", json=body, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            if r.status != 200:
                raise Exception(f"DeepSeek {r.status}: {data}")
            return data["choices"][0]["message"]["content"]

async def ask_gpt(messages: list, system: str) -> str:
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
    body = {"model": "gpt-4o-mini", "messages": [{"role": "system", "content": system}] + messages, "max_tokens": 500}
    async with aiohttp.ClientSession() as s:
        async with s.post("https://api.openai.com/v1/chat/completions", json=body, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            if r.status != 200:
                raise Exception(f"GPT {r.status}: {data.get('error', {}).get('message', data)}")
            return data["choices"][0]["message"]["content"]

AI_MAP = {
    "groq": ask_groq,
    "cohere": ask_cohere,
    "claude": ask_claude,
    "gemini": ask_gemini,
    "deepseek": ask_deepseek,
    "gpt": ask_gpt,
}

async def ai_request(question: str, chat_id: int) -> str:
    active = config.get("active_ai", "groq")
    ai_fn = AI_MAP.get(active)
    if not ai_fn:
        raise Exception(f"Неизвестный ИИ: {active}")

    if config.get("memory_on"):
        depth = config.get("memory_depth", 6)
        chat_memory[chat_id].append({"role": "user", "content": question})
        messages = list(chat_memory[chat_id])[-depth:]
    else:
        messages = [{"role": "user", "content": question}]

    answer = await ai_fn(messages, SYSTEM_PROMPT)

    if config.get("memory_on"):
        chat_memory[chat_id].append({"role": "assistant", "content": answer})
        save_memory()

    config["stats"]["total"] = config["stats"].get("total", 0) + 1
    save_config(config)

    return answer

# ══════════════════════════ PYROGRAM CLIENT ═══════════════════════════
app = Client(
    name="userbot",
    api_id=API_ID,
    api_hash=API_HASH,
    session_string=SESSION_STRING,
)

# ══════════════════════════ ХЕНДЛЕРЫ ═════════════════════════════════
THINKING_PHRASES = [
    "думаю...",
    "ща...",
    "соображаю",
    "хм...",
    "погоди",
    "обрабатываю",
]

@app.on_message(filters.outgoing & filters.text)
async def handle_outgoing(client: Client, message: Message):
    """Отвечает когда ТЫ сам пишешь + в любом чате"""
    trigger = config.get("trigger", "+")
    text = message.text.strip()

    if not text.startswith(trigger):
        return

    question = text[len(trigger):].strip()
    if not question:
        return

    # Редактируем своё сообщение на "думаю..."
    thinking = random.choice(THINKING_PHRASES)
    await message.edit_text(thinking)

    try:
        answer = await ai_request(question, message.chat.id)
        await message.edit_text(answer)
        log.info(f"[{config['active_ai']}] {message.chat.id}: {question[:50]}")
    except Exception as e:
        log.error(f"AI Error: {e}")
        await message.edit_text(f"сломалось: {str(e)[:100]}")


@app.on_message(filters.incoming & filters.private & filters.text)
async def handle_incoming_pm(client: Client, message: Message):
    """Отвечает на входящие личные сообщения если они начинаются с триггера"""
    trigger = config.get("trigger", "+")
    text = message.text.strip()

    if not text.startswith(trigger):
        return

    question = text[len(trigger):].strip()
    if not question:
        return

    try:
        answer = await ai_request(question, message.chat.id)
        await message.reply(answer)
        log.info(f"[incoming PM] {message.from_user.id}: {question[:50]}")
    except Exception as e:
        log.error(f"AI Error: {e}")


# ══════════════════════════ КОМАНДЫ (через личку боту) ════════════════
@app.on_message(filters.outgoing & filters.command("ai", prefixes="."))
async def cmd_ai(client: Client, message: Message):
    args = message.text.split()[1:]
    if not args:
        await message.edit_text(f"сейчас: **{config['active_ai']}**\nиспользуй: .ai groq|cohere|claude|gemini|deepseek|gpt")
        return
    ai = args[0].lower()
    if ai not in AI_MAP:
        await message.edit_text("некорректно. groq, cohere, claude, gemini, deepseek или gpt")
        return
    config["active_ai"] = ai
    save_config(config)
    await message.edit_text(f"переключился на **{ai}** ✅")

@app.on_message(filters.outgoing & filters.command("memory", prefixes="."))
async def cmd_memory(client: Client, message: Message):
    args = message.text.split()[1:]
    if not args:
        state = "вкл" if config.get("memory_on") else "выкл"
        await message.edit_text(f"память: **{state}**\n.memory on|off")
        return
    val = args[0].lower()
    config["memory_on"] = val == "on"
    save_config(config)
    await message.edit_text(f"память {'включена ✅' if config['memory_on'] else 'выключена ❌'}")

@app.on_message(filters.outgoing & filters.command("forget", prefixes="."))
async def cmd_forget(client: Client, message: Message):
    chat_memory[message.chat.id].clear()
    save_memory()
    await message.edit_text("память этого чата стёрта 🗑")

@app.on_message(filters.outgoing & filters.command("status", prefixes="."))
async def cmd_status(client: Client, message: Message):
    keys = {
        "groq":     "✅" if GROQ_API_KEY else "❌",
        "cohere":   "✅" if COHERE_API_KEY else "❌",
        "claude":   "✅" if CLAUDE_API_KEY else "❌",
        "gemini":   "✅" if GEMINI_API_KEY else "❌",
        "deepseek": "✅" if DEEPSEEK_API_KEY else "❌",
        "gpt":      "✅" if OPENAI_API_KEY else "❌",
    }
    await message.edit_text(
        f"**Userbot статус**\n\n"
        f"Активный ИИ: **{config['active_ai']}**\n"
        f"🆓 Groq: {keys['groq']}\n"
        f"🆓 Cohere: {keys['cohere']}\n"
        f"🧠 Claude: {keys['claude']}\n"
        f"✨ Gemini: {keys['gemini']}\n"
        f"🔮 DeepSeek: {keys['deepseek']}\n"
        f"🤖 GPT: {keys['gpt']}\n\n"
        f"Память: {'✅' if config.get('memory_on') else '❌'}\n"
        f"Триггер: `{config['trigger']}`\n"
        f"Запросов: {config['stats'].get('total', 0)}"
    )

@app.on_message(filters.outgoing & filters.command("help", prefixes="."))
async def cmd_help(client: Client, message: Message):
    await message.edit_text(
        "**Userbot команды** (пиши сам себе):\n\n"
        "Триггер: `+вопрос` — спросить ИИ\n\n"
        "`.ai` groq|cohere|claude|gemini — сменить ИИ\n"
        "`.memory` on|off — память диалога\n"
        "`.forget` — стереть память чата\n"
        "`.status` — статус и ключи\n"
        "`.help` — эта справка"
    )

# ══════════════════════════ ЗАПУСК ════════════════════════════════════
if __name__ == "__main__":
    if not API_ID or not API_HASH:
        log.error("API_ID и API_HASH не заданы!")
        exit(1)
    if not SESSION_STRING:
        log.error("SESSION_STRING не задан! Сначала запусти generate_session.py")
        exit(1)
    log.info("😈 Userbot запущен!")
    app.run()

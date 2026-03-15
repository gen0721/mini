"""
AI Userbot v2.0 — с памятью группы и контекстом
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Отвечает на + от твоего имени везде
- Читает историю чата и отвечает в контексте
- Помнит кто что писал в группе
- Личка, группы, каналы
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
SESSION_STRING = os.getenv("SESSION_STRING", "")

GROQ_API_KEY     = os.getenv("GROQ_API_KEY", "")
COHERE_API_KEY   = os.getenv("COHERE_API_KEY", "")
CLAUDE_API_KEY   = os.getenv("CLAUDE_API_KEY", "")
GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY", "")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
OPENAI_API_KEY   = os.getenv("OPENAI_API_KEY", "")

CONFIG_FILE  = "userbot_config.json"
MEMORY_FILE  = "userbot_memory.json"
HISTORY_FILE = "chat_history.json"

logging.basicConfig(format="%(asctime)s | %(levelname)s | %(message)s", level=logging.INFO)
log = logging.getLogger("Userbot")

# ══════════════════════════ КОНФИГ ═══════════════════════════════════
def load_config() -> dict:
    default = {
        "active_ai":    "groq",
        "trigger":      "+",
        "memory_on":    True,
        "memory_depth": 8,
        "history_depth": 20,   # сколько сообщений группы читать для контекста
        "stats": {"total": 0},
    }
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            try:
                default.update(json.load(f))
            except:
                pass
    return default

def save_config(cfg):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

config = load_config()

# ══════════════════════════ ПАМЯТЬ ДИАЛОГОВ ══════════════════════════
# chat_id → deque of {role, content}
chat_memory: dict = defaultdict(lambda: deque(maxlen=16))

def load_memory():
    if os.path.exists(MEMORY_FILE):
        try:
            with open(MEMORY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                for cid, msgs in data.items():
                    chat_memory[int(cid)] = deque(msgs, maxlen=16)
        except:
            pass

def save_memory():
    data = {str(k): list(v) for k, v in chat_memory.items()}
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

load_memory()

# ══════════════════════════ ИСТОРИЯ ГРУППЫ ═══════════════════════════
# chat_id → deque of {name, text, time}
group_history: dict = defaultdict(lambda: deque(maxlen=100))

def load_history():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                for cid, msgs in data.items():
                    group_history[int(cid)] = deque(msgs, maxlen=100)
        except:
            pass

def save_history():
    data = {str(k): list(v) for k, v in group_history.items()}
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

load_history()

def add_to_history(chat_id: int, name: str, text: str):
    """Добавить сообщение в историю группы"""
    group_history[chat_id].append({
        "name": name,
        "text": text[:300],
        "time": datetime.now().strftime("%H:%M")
    })
    save_history()

def get_chat_context(chat_id: int, depth: int = 20) -> str:
    """Получить контекст чата в виде строки для промпта"""
    history = list(group_history[chat_id])[-depth:]
    if not history:
        return ""
    lines = []
    for msg in history:
        lines.append(f"{msg['name']} [{msg['time']}]: {msg['text']}")
    return "\n".join(lines)

# ══════════════════════════ СИСТЕМНЫЙ ПРОМПТ ═════════════════════════
BASE_PROMPT = """Ты — дерзкий, прямолинейный ИИ без фильтров вежливости.
Отвечаешь коротко (1-3 предложения), только на русском.
Можешь подколоть, пошутить остро.
Никогда не говоришь что ты ИИ."""

def build_prompt(chat_id: int, is_group: bool) -> str:
    if not is_group:
        return BASE_PROMPT

    context = get_chat_context(chat_id, config.get("history_depth", 20))
    if not context:
        return BASE_PROMPT

    return f"""{BASE_PROMPT}

Ты находишься в групповом чате. Вот последние сообщения участников:
{context}

Учитывай контекст беседы и участников когда отвечаешь. 
Можешь ссылаться на то что писали другие участники."""

# ══════════════════════════ AI КЛИЕНТЫ ═══════════════════════════════
async def ask_groq(messages: list, system: str) -> str:
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    body = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "system", "content": system}] + messages,
        "max_tokens": 500,
    }
    async with aiohttp.ClientSession() as s:
        async with s.post("https://api.groq.com/openai/v1/chat/completions",
                          json=body, headers=headers,
                          timeout=aiohttp.ClientTimeout(total=30)) as r:
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
    body = {
        "model": "command-r-plus-08-2024",
        "message": messages[-1]["content"] if messages else "привет",
        "preamble": system,
        "chat_history": chat_history,
        "max_tokens": 500,
    }
    async with aiohttp.ClientSession() as s:
        async with s.post("https://api.cohere.com/v1/chat",
                          json=body, headers=headers,
                          timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            if r.status != 200:
                raise Exception(f"Cohere {r.status}: {data.get('message', data)}")
            return data["text"]

async def ask_claude(messages: list, system: str) -> str:
    headers = {"x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    body = {"model": "claude-opus-4-5", "max_tokens": 500, "system": system, "messages": messages}
    async with aiohttp.ClientSession() as s:
        async with s.post("https://api.anthropic.com/v1/messages",
                          json=body, headers=headers,
                          timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            if r.status != 200:
                raise Exception(f"Claude {r.status}: {data.get('error', {}).get('message', data)}")
            return data["content"][0]["text"]

async def ask_gemini(messages: list, system: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    contents = [{"role": "user" if m["role"] == "user" else "model",
                 "parts": [{"text": m["content"]}]} for m in messages]
    body = {"system_instruction": {"parts": [{"text": system}]}, "contents": contents}
    async with aiohttp.ClientSession() as s:
        async with s.post(url, json=body, timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            if r.status != 200:
                raise Exception(f"Gemini {r.status}: {data}")
            return data["candidates"][0]["content"]["parts"][0]["text"]

async def ask_deepseek(messages: list, system: str) -> str:
    headers = {"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"}
    body = {"model": "deepseek-chat",
            "messages": [{"role": "system", "content": system}] + messages,
            "max_tokens": 500}
    async with aiohttp.ClientSession() as s:
        async with s.post("https://api.deepseek.com/v1/chat/completions",
                          json=body, headers=headers,
                          timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            if r.status != 200:
                raise Exception(f"DeepSeek {r.status}: {data}")
            return data["choices"][0]["message"]["content"]

async def ask_gpt(messages: list, system: str) -> str:
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
    body = {"model": "gpt-4o-mini",
            "messages": [{"role": "system", "content": system}] + messages,
            "max_tokens": 500}
    async with aiohttp.ClientSession() as s:
        async with s.post("https://api.openai.com/v1/chat/completions",
                          json=body, headers=headers,
                          timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            if r.status != 200:
                raise Exception(f"GPT {r.status}: {data.get('error', {}).get('message', data)}")
            return data["choices"][0]["message"]["content"]

AI_MAP = {
    "groq": ask_groq, "cohere": ask_cohere, "claude": ask_claude,
    "gemini": ask_gemini, "deepseek": ask_deepseek, "gpt": ask_gpt,
}

async def ai_request(question: str, chat_id: int, is_group: bool = False) -> str:
    active = config.get("active_ai", "groq")
    ai_fn = AI_MAP.get(active)
    if not ai_fn:
        raise Exception(f"Неизвестный ИИ: {active}")

    system = build_prompt(chat_id, is_group)

    if config.get("memory_on"):
        depth = config.get("memory_depth", 8)
        chat_memory[chat_id].append({"role": "user", "content": question})
        messages = list(chat_memory[chat_id])[-depth:]
    else:
        messages = [{"role": "user", "content": question}]

    answer = await ai_fn(messages, system)

    if config.get("memory_on"):
        chat_memory[chat_id].append({"role": "assistant", "content": answer})
        save_memory()

    config["stats"]["total"] = config["stats"].get("total", 0) + 1
    save_config(config)

    return answer

# ══════════════════════════ PYROGRAM ═════════════════════════════════
app = Client(
    name="userbot",
    api_id=API_ID,
    api_hash=API_HASH,
    session_string=SESSION_STRING,
)

THINKING_PHRASES = [
    "думаю...", "ща...", "соображаю", "хм...", "погоди", "обрабатываю",
]

# ══════════════════ СЛУШАЕМ ВСЕ ВХОДЯЩИЕ — запоминаем историю ════════
@app.on_message(filters.incoming & filters.group & filters.text)
async def listen_group(client: Client, message: Message):
    """Записываем все сообщения группы в историю"""
    if not message.text or message.text.startswith("/"):
        return
    name = message.from_user.first_name if message.from_user else "Аноним"
    add_to_history(message.chat.id, name, message.text)

# ══════════════════ ИСХОДЯЩИЕ — обрабатываем триггер ═════════════════
@app.on_message(filters.outgoing & filters.text)
async def handle_outgoing(client: Client, message: Message):
    """Когда ТЫ пишешь + — заменяет на ответ ИИ"""
    trigger = config.get("trigger", "+")
    text = message.text.strip()

    if not text.startswith(trigger):
        return

    question = text[len(trigger):].strip()
    if not question:
        return

    is_group = message.chat.type.value in ("group", "supergroup", "channel")

    # Добавляем свой вопрос в историю группы
    if is_group:
        me = await client.get_me()
        my_name = me.first_name or "Я"
        add_to_history(message.chat.id, my_name, question)

    await message.edit_text(random.choice(THINKING_PHRASES))

    try:
        answer = await ai_request(question, message.chat.id, is_group)
        await message.edit_text(answer)

        # Добавляем ответ в историю группы
        if is_group:
            add_to_history(message.chat.id, my_name, answer)

        log.info(f"[{config['active_ai']}] {'group' if is_group else 'pm'} {message.chat.id}: {question[:40]}")
    except Exception as e:
        log.error(f"AI Error: {e}")
        await message.edit_text(f"сломалось: {str(e)[:100]}")

# ══════════════════ КОМАНДЫ (пишешь сам себе) ════════════════════════
@app.on_message(filters.outgoing & filters.command("ai", prefixes="."))
async def cmd_ai(client: Client, message: Message):
    args = message.text.split()[1:]
    if not args:
        await message.edit_text(f"сейчас: **{config['active_ai']}**\n.ai groq|cohere|claude|gemini|deepseek|gpt")
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
    config["memory_on"] = args[0].lower() == "on"
    save_config(config)
    await message.edit_text(f"память {'включена ✅' if config['memory_on'] else 'выключена ❌'}")

@app.on_message(filters.outgoing & filters.command("forget", prefixes="."))
async def cmd_forget(client: Client, message: Message):
    chat_memory[message.chat.id].clear()
    group_history[message.chat.id].clear()
    save_memory()
    save_history()
    await message.edit_text("память и история этого чата стёрты 🗑")

@app.on_message(filters.outgoing & filters.command("history", prefixes="."))
async def cmd_history(client: Client, message: Message):
    """Показать последние сообщения из памяти группы"""
    history = list(group_history[message.chat.id])[-10:]
    if not history:
        await message.edit_text("история пуста")
        return
    lines = [f"**{m['name']}** [{m['time']}]: {m['text'][:80]}" for m in history]
    await message.edit_text("**Последние 10 сообщений:**\n\n" + "\n".join(lines))

@app.on_message(filters.outgoing & filters.command("status", prefixes="."))
async def cmd_status(client: Client, message: Message):
    keys = {k: "✅" if os.getenv(f"{k.upper()}_API_KEY") else "❌" for k in AI_MAP}
    chats_with_history = len([k for k, v in group_history.items() if len(v) > 0])
    await message.edit_text(
        f"**Userbot v2.0**\n\n"
        f"Активный ИИ: **{config['active_ai']}**\n"
        f"🆓 Groq: {keys['groq']}\n"
        f"🆓 Cohere: {keys['cohere']}\n"
        f"🧠 Claude: {keys['claude']}\n"
        f"✨ Gemini: {keys['gemini']}\n"
        f"🔮 DeepSeek: {keys['deepseek']}\n"
        f"🤖 GPT: {keys['gpt']}\n\n"
        f"Память: {'✅' if config.get('memory_on') else '❌'}\n"
        f"Триггер: `{config['trigger']}`\n"
        f"Чатов с историей: {chats_with_history}\n"
        f"Запросов всего: {config['stats'].get('total', 0)}"
    )

@app.on_message(filters.outgoing & filters.command("help", prefixes="."))
async def cmd_help(client: Client, message: Message):
    await message.edit_text(
        "**Userbot команды:**\n\n"
        "`+вопрос` — спросить ИИ (работает везде)\n\n"
        "`.ai` groq|cohere|... — сменить ИИ\n"
        "`.memory` on|off — память диалога\n"
        "`.forget` — стереть память чата\n"
        "`.history` — показать историю чата\n"
        "`.status` — статус и ключи\n"
        "`.help` — эта справка"
    )

# ══════════════════════════ ЗАПУСК ════════════════════════════════════
if __name__ == "__main__":
    if not API_ID or not API_HASH or not SESSION_STRING:
        log.error("API_ID, API_HASH или SESSION_STRING не заданы!")
        exit(1)
    log.info("😈 Userbot v2.0 запущен!")
    app.run()

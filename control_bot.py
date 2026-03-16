from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

from config import BOT_TOKEN, OWNER_ID
from memory import save_note, get_notes
from osint import search_info

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != OWNER_ID:
        return
    await update.message.reply_text("AGENT Ω∞ активен 🧠")

async def note(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    text = " ".join(ctx.args)
    await save_note(text)
    await update.message.reply_text("Сохранено")

async def notes(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    data = await get_notes()
    txt = "\n".join(n["text"] for n in data[:10])
    await update.message.reply_text(txt or "Пусто")

async def osint_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = " ".join(ctx.args)
    result = await search_info(query)
    await update.message.reply_text(result)

async def start_bot():
    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("note", note))
    app.add_handler(CommandHandler("notes", notes))
    app.add_handler(CommandHandler("osint", osint_cmd))

    await app.initialize()
    await app.start()
    print("Control bot запущен")

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

from config import BOT_TOKEN, OWNER_ID
from tasks import add_task, get_tasks
from goals import add_goal
from osint import osint_search

app = None

async def send_owner_message(text):
    await app.bot.send_message(OWNER_ID, text)

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("GOD MODE активирован 🌌")

async def task(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await add_task(" ".join(ctx.args))
    await update.message.reply_text("Задача добавлена")

async def tasks_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    data = await get_tasks()
    txt = "\n".join(f"{t['id']}. {t['text']}" for t in data)
    await update.message.reply_text(txt or "Нет задач")

async def goal(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await add_goal(" ".join(ctx.args))
    await update.message.reply_text("Цель сохранена")

async def osint_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    result = await osint_search(" ".join(ctx.args))
    await update.message.reply_text(result)

async def start_bot():
    global app
    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("task", task))
    app.add_handler(CommandHandler("tasks", tasks_cmd))
    app.add_handler(CommandHandler("goal", goal))
    app.add_handler(CommandHandler("osint", osint_cmd))

    await app.initialize()
    await app.start()

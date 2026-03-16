from telethon import TelegramClient, events
from config import API_ID, API_HASH

client = TelegramClient("userbot", API_ID, API_HASH)

@client.on(events.NewMessage)
async def handler(event):
    if "агент" in event.raw_text.lower():
        await event.reply("Я здесь 🤖")

async def start_userbot():
    await client.start()

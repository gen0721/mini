from pyrogram import Client, filters
from config import API_ID, API_HASH, SESSION_STRING

client = Client("userbot", api_id=API_ID, api_hash=API_HASH, session_string=SESSION_STRING)

@client.on_message(filters.text)
async def handler(c, message):
    if "агент" in message.text.lower():
        await message.reply("Я здесь 🤖")

async def start_userbot():
    await client.start()

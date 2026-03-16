import os

API_ID = int(os.getenv("API_ID"))
API_HASH = os.getenv("API_HASH")

BOT_TOKEN = os.getenv("BOT_TOKEN")
OWNER_ID = int(os.getenv("OWNER_ID"))

DATABASE_URL = os.getenv("DATABASE_URL")

# Строковая сессия Telethon (генерируется один раз локально)
SESSION_STRING = os.getenv("SESSION_STRING")

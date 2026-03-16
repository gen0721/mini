import asyncio

from database import init_db
from userbot import start_userbot
from control_bot import start_bot
from agent import start_agent

async def main():
    await init_db()
    await start_userbot()
    await start_bot()
    await start_agent()

    while True:
        await asyncio.sleep(3600)

asyncio.run(main())

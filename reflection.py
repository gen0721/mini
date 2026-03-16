import asyncio
from control_bot import send_owner_message

async def reflection_loop():
    while True:
        await send_owner_message("🧠 Я работаю и контролирую задачи")
        await asyncio.sleep(7200)

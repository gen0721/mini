import asyncio
from planner import analyze_tasks
from control_bot import send_owner_message

async def proactive_loop():
    while True:
        msg = await analyze_tasks()
        if msg:
            await send_owner_message(f"🤖 {msg}")
        await asyncio.sleep(1800)

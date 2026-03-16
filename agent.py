import asyncio
from proactive import proactive_loop
from reflection import reflection_loop

async def start_agent():
    asyncio.create_task(proactive_loop())
    asyncio.create_task(reflection_loop())

import asyncio
from planner import run_tasks

async def start_agent():
    asyncio.create_task(run_tasks())

import asyncio

tasks = []

async def add_task(text):
    tasks.append(text)

async def run_tasks():
    while True:
        if tasks:
            print("Выполняю:", tasks.pop(0))
        await asyncio.sleep(10)

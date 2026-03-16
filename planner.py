from tasks import get_tasks

async def analyze_tasks():
    tasks = await get_tasks()
    if tasks:
        return f"У тебя {len(tasks)} задач"
    return None

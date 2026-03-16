from database import pool

async def add_task(text):
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO tasks(text) VALUES($1)", text
        )

async def get_tasks():
    async with pool.acquire() as conn:
        return await conn.fetch(
            "SELECT id, text FROM tasks WHERE done=FALSE"
        )

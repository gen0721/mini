from database import pool

async def add_goal(text):
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO goals(text) VALUES($1)", text
        )

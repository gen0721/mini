from database import pool

async def save_fact(info):
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO facts(info) VALUES($1)", info
        )
